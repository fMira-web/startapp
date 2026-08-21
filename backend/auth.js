import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import * as db from './db.js';
import * as market from './market-db.js';
import { sendCodeEmail } from './mailer.js';

const scrypt = promisify(crypto.scrypt);

const IS_PRODUCTION = (process.env.NODE_ENV ?? 'development') === 'production';
const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'proposal_session';
const SESSION_DAYS = 7;

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

const PURPOSE_VERIFY = 'verify_email';

/* ------------------------------------------------------------------ */
/* Роли и суперадминистратор                                           */
/* ------------------------------------------------------------------ */

/**
 * Почта владельца площадки. Аккаунт с этим адресом получает права
 * суперадминистратора при регистрации и восстанавливает их при каждом
 * старте сервера — даже если кто-то снял флаг вручную в базе.
 */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? 'mmirazizf930@gmail.com')
  .trim()
  .toLowerCase();

export const ROLES = ['client', 'developer'];

function normaliseRole(value) {
  return value === 'developer' ? 'developer' : value === 'client' ? 'client' : null;
}

/**
 * Права суперадмина сильнее любого флага в базе: даже если запись владельца
 * потеряет is_admin, эта функция вернёт его на месте при следующем старте.
 */
export async function ensureSuperAdmin() {
  const owner = await db.findUserByEmail(OWNER_EMAIL);
  if (!owner) return { email: OWNER_EMAIL, present: false };
  if (owner.is_admin !== true) await db.setAdmin(owner.id, true);
  if (owner.is_blocked === true) await db.setBlocked(owner.id, false);
  return { email: OWNER_EMAIL, present: true, id: owner.id };
}

export function isOwner(user) {
  return String(user?.email ?? '').toLowerCase() === OWNER_EMAIL;
}

/* ------------------------------------------------------------------ */
/* Passwords — scrypt from node:crypto, no native dependency to build  */
/* ------------------------------------------------------------------ */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join(
    '$'
  );
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code, codeId) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${codeId}:${code}`).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

const WEAK_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', 'qwertyui', 'qwerty123',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', '11111111', 'abc12345',
]);

function normaliseEmail(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * NIST 800-63B: length is what matters. No composition rules, no forced
 * rotation, paste allowed — just a floor, a ceiling, and a blocklist.
 */
function validatePassword(value) {
  if (typeof value !== 'string') return 'Choose a password.';
  if (value.length < 8) return 'Пароль — минимум 8 символов.';
  if (value.length > 200) return 'That password is too long.';
  if (WEAK_PASSWORDS.has(value.toLowerCase())) return 'Такой пароль слишком простой. Выберите другой.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

function issueSession(res, user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, verified: user.email_verified === true },
    JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    // The Vercel frontend and the Render API are different sites in
    // production, so the cookie has to be SameSite=None; Secure.
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/',
  });
}

export function readSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ code: 'unauthenticated', message: 'Войдите, чтобы продолжить.' });
  }
  req.session = session;
  return next();
}

/**
 * Как requireAuth, но кладёт в `req.user` свежую запись из базы. Роль,
 * права администратора и блокировка проверяются по базе, а не по подписи
 * в куке: иначе разжалованный админ оставался бы админом до конца сессии.
 */
export async function requireUser(req, res, next) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ code: 'unauthenticated', message: 'Войдите, чтобы продолжить.' });
  }
  try {
    const user = await db.findUserById(session.sub);
    if (!user || user.email_verified !== true) {
      clearSession(res);
      return res.status(401).json({ code: 'unauthenticated', message: 'Войдите, чтобы продолжить.' });
    }
    if (user.is_blocked === true) {
      return res.status(403).json({
        code: 'account_blocked',
        message: user.blocked_reason
          ? `Аккаунт заблокирован: ${user.blocked_reason}`
          : 'Аккаунт заблокирован администратором.',
      });
    }
    req.session = session;
    req.user = user;
    return next();
  } catch (error) {
    console.error('requireUser error:', error);
    return res.status(500).json({ code: 'server_error', message: 'Не удалось проверить сессию.' });
  }
}

/**
 * Мягкая авторизация для публичных маршрутов: если сессия есть — кладём
 * пользователя в `req.user`, если нет — просто пропускаем дальше. Нужна
 * там, где ответ зависит от того, кто смотрит (например, отклики видны
 * заказчику, но не случайному гостю).
 */
export async function attachUser(req, _res, next) {
  const session = readSession(req);
  if (!session) return next();
  try {
    const user = await db.findUserById(session.sub);
    if (user && user.email_verified === true && user.is_blocked !== true) {
      req.session = session;
      req.user = user;
    }
  } catch (error) {
    console.warn('attachUser:', error.message);
  }
  return next();
}

/** Доступ только владельцу площадки — суперадминистратору. */
export function requireOwner(req, res, next) {
  if (isOwner(req.user)) return next();
  return res.status(403).json({
    code: 'owner_only',
    message: 'Это действие доступно только суперадминистратору площадки.',
  });
}

/** Доступ только администраторам (включая владельца площадки). */
export function requireAdmin(req, res, next) {
  if (req.user?.is_admin === true || isOwner(req.user)) return next();
  return res.status(403).json({ code: 'forbidden', message: 'Нужны права администратора.' });
}

/** Доступ только выбранной роли: `requireRole('client')`. */
export function requireRole(role) {
  return function guard(req, res, next) {
    if (req.user?.role === role) return next();
    return res.status(403).json({
      code: 'wrong_role',
      message:
        role === 'client'
          ? 'Это действие доступно только заказчикам.'
          : 'Это действие доступно только программистам.',
    });
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatar_url ?? null,
    /** Назначается один раз при регистрации и клиентом не меняется. */
    role: user.role ?? 'client',
    isAdmin: user.is_admin === true,
    isOwner: isOwner(user),
    isBlocked: user.is_blocked === true,
    emailVerified: user.email_verified === true,
    createdAt: user.created_at ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Code issuing                                                        */
/* ------------------------------------------------------------------ */

async function issueCode(user, { intro }) {
  const existing = await db.latestCode({ userId: user.id, purpose: PURPOSE_VERIFY });
  if (existing) {
    const age = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
    if (age < RESEND_COOLDOWN_SECONDS) {
      const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - age);
      const error = new Error(`Please wait ${retryAfter} seconds before requesting another code.`);
      error.status = 429;
      error.code = 'cooldown';
      error.retryAfter = retryAfter;
      throw error;
    }
  }

  await db.invalidateCodes({ userId: user.id, purpose: PURPOSE_VERIFY });

  // The id is generated here so the stored digest can be keyed to it —
  // the plain code is never written anywhere.
  const code = generateCode();
  const codeId = crypto.randomUUID();
  await db.createCode({
    id: codeId,
    userId: user.id,
    codeHash: hashCode(code, codeId),
    purpose: PURPOSE_VERIFY,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  // Бросает, если письмо не ушло. Код существует в базе только хешем и
  // наружу не отдаётся ни при каких настройках — единственный канал это письмо.
  await sendCodeEmail({
    to: user.email,
    code,
    name: user.full_name,
    intro,
  });

  return { resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

async function checkCode(user, submitted) {
  const record = await db.latestCode({ userId: user.id, purpose: PURPOSE_VERIFY });
  if (!record || new Date(record.expires_at).getTime() <= Date.now()) {
    const error = new Error('Срок кода истёк. Запросите новый.');
    error.status = 410;
    error.code = 'expired';
    throw error;
  }

  const attempts = await db.bumpAttempts(record.id);
  if (attempts > MAX_CODE_ATTEMPTS) {
    await db.consumeCode(record.id);
    const error = new Error('Слишком много неверных попыток. Запросите новый код.');
    error.status = 429;
    error.code = 'too_many_attempts';
    throw error;
  }

  const candidate = Buffer.from(hashCode(submitted, record.id));
  const expected = Buffer.from(record.code_hash);
  const matches =
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);

  if (!matches) {
    const remaining = MAX_CODE_ATTEMPTS - attempts;
    const error = new Error(
      remaining > 0
        ? `Код неверный. Осталось попыток: ${remaining}.`
        : 'Код неверный.'
    );
    error.status = 401;
    error.code = 'invalid_code';
    throw error;
  }

  await db.consumeCode(record.id);
}

/** Нарушение уникального индекса по email — в Postgres это код 23505. */
function isDuplicateEmail(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return (
    code === '23505' ||
    code === 'P2002' ||
    message.includes('users_email_key') ||
    (message.includes('duplicate key') && message.includes('email'))
  );
}

function fail(res, error) {
  const status = error.status ?? 500;
  if (status >= 500) console.error('Auth error:', error);
  // error.expose — ошибка, текст которой написан для человека и не выдаёт
  // ничего лишнего: например, «письмо с кодом не ушло».
  const readable = status < 500 || error.expose === true;
  return res.status(status).json({
    code: error.code ?? 'server_error',
    message: readable ? error.message : 'Something went wrong. Try again.',
    ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    ...(error.field ? { field: error.field } : {}),
    // Техническая причина отказа почты — тому, кто настраивает сервер.
    // В продакшене её не показываем: она называет логин отправителя.
    ...(!IS_PRODUCTION && error.reason ? { detail: error.reason } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export function registerAuthRoutes(app, { authLimiter, codeLimiter }) {
  /* --- register ------------------------------------------------------ */
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { email, password, fullName, phone, role, devProfile } = req.body ?? {};

      /* Роль — обязательный шаг регистрации и единственный момент, когда
         её вообще можно выбрать. Дальше она фиксируется. */
      const accountRole = normaliseRole(role);
      if (!accountRole) {
        return res.status(400).json({
          code: 'bad_role',
          field: 'role',
          message: 'Выберите роль: заказчик или программист.',
        });
      }

      /* Для программиста регистрация двухшаговая: сфера, стек и уровень
         собираются здесь же и сразу становятся профилем. */
      let devInput = null;
      if (accountRole === 'developer') {
        const source = devProfile ?? {};
        if (!market.SPHERE_IDS.has(source.sphere)) {
          return res.status(400).json({
            code: 'bad_sphere',
            field: 'sphere',
            message: 'Выберите сферу разработки.',
          });
        }
        if (!market.LEVEL_IDS.has(source.level)) {
          return res.status(400).json({
            code: 'bad_level',
            field: 'level',
            message: 'Выберите уровень: Junior, Middle, Senior или Lead.',
          });
        }
        const stack = typeof source.stack === 'string' ? source.stack.trim() : '';
        if (stack.length < 2) {
          return res.status(400).json({
            code: 'bad_stack',
            field: 'stack',
            message: 'Укажите основной стек технологий.',
          });
        }
        devInput = {
          sphere: source.sphere,
          level: source.level,
          stack: stack.slice(0, 400),
          headline: typeof source.headline === 'string' ? source.headline.trim().slice(0, 160) : null,
          city: typeof source.city === 'string' ? source.city.trim().slice(0, 80) : null,
          rateHour: Math.max(0, Math.min(50_000_000, Number(source.rateHour) || 0)),
        };
      }

      const normalisedEmail = normaliseEmail(email);
      if (!normalisedEmail) {
        return res
          .status(400)
          .json({ code: 'bad_email', field: 'email', message: 'Введите корректный адрес почты.' });
      }

      const passwordProblem = validatePassword(password);
      if (passwordProblem) {
        return res
          .status(400)
          .json({ code: 'bad_password', field: 'password', message: passwordProblem });
      }

      const cleanPhone =
        typeof phone === 'string' && phone.trim() ? phone.trim() : null;
      if (cleanPhone && !E164_RE.test(cleanPhone)) {
        return res
          .status(400)
          .json({ code: 'bad_phone', field: 'phone', message: 'Введите корректный номер телефона.' });
      }

      const existing = await db.findUserByEmail(normalisedEmail);
      if (existing) {
        if (existing.email_verified) {
          return res.status(409).json({
            code: 'email_taken',
            field: 'email',
            message: 'На эту почту уже есть аккаунт. Войдите.',
          });
        }
        // Registered but never verified: re-send rather than block.
        // Кулдаун — тоже не повод показывать ошибку: предыдущий код ещё
        // жив, человека просто ведём на экран ввода.
        let result;
        try {
          result = await issueCode(existing, {
            intro: 'Введите код ниже, чтобы подтвердить почту и активировать аккаунт.',
          });
        } catch (error) {
          if (error.code !== 'cooldown') throw error;
          result = { resendAfterSeconds: error.retryAfter ?? RESEND_COOLDOWN_SECONDS };
        }
        return res.status(200).json({
          status: 'verification_sent',
          email: existing.email,
          // Роль показываем ту, что уже зафиксирована за аккаунтом:
          // повторная регистрация не способ её поменять.
          role: existing.role ?? accountRole,
          roleLocked: (existing.role ?? accountRole) !== accountRole,
          ...result,
        });
      }

      let user;
      try {
        user = await db.createUser({
          email: normalisedEmail,
          passwordHash: await hashPassword(password),
          fullName:
            typeof fullName === 'string' && fullName.trim() ? fullName.trim().slice(0, 120) : null,
          phone: cleanPhone,
          role: accountRole,
          // Владелец площадки получает права сразу, без ручного шага.
          isAdmin: normalisedEmail === OWNER_EMAIL,
        });
      } catch (createError) {
        // Уникальный индекс по email — вторая линия обороны после проверки
        // выше: две одновременные регистрации одного адреса доходят сюда
        // обе. Это тот же самый отказ «почта занята», а не сбой сервера.
        if (isDuplicateEmail(createError)) {
          return res.status(409).json({
            code: 'email_taken',
            field: 'email',
            message: 'На эту почту уже есть аккаунт. Войдите.',
          });
        }
        throw createError;
      }

      // Профиль заводится сразу — иначе на доске появится аккаунт без
      // единого поля, а карточку исполнителя нечем будет показать.
      try {
        if (accountRole === 'developer') await market.upsertDevProfile(user.id, devInput);
        else await market.upsertClientProfile(user.id, {});
      } catch (profileError) {
        console.warn('Не удалось создать профиль:', profileError.message);
      }

      let result;
      try {
        result = await issueCode(user, {
          intro: 'Введите код ниже, чтобы подтвердить почту и активировать аккаунт.',
        });
      } catch (error) {
        // Письмо не ушло — значит регистрации не было. Свежесозданную запись
        // удаляем, иначе в базе копятся аккаунты с email_verified = false,
        // на которые невозможно войти и невозможно зарегистрироваться заново.
        try {
          await db.deleteUser(user.id);
        } catch (cleanupError) {
          console.error('Не удалось откатить регистрацию:', cleanupError.message);
        }
        // Ошибку доставки НЕ вешаем на поле «email»: дело почти никогда не
        // в адресе, а в настройке сервера. Под полем ввода такая подпись
        // заставляет человека править правильно набранную почту.
        throw error;
      }

      return res
        .status(201)
        .json({ status: 'verification_sent', email: user.email, role: accountRole, ...result });
    } catch (error) {
      return fail(res, error);
    }
  });

  /* --- verify email -------------------------------------------------- */
  app.post('/api/auth/verify-email', codeLimiter, async (req, res) => {
    try {
      const { email, code } = req.body ?? {};
      const normalisedEmail = normaliseEmail(email);
      if (!normalisedEmail || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ code: 'bad_input', message: 'Введите шестизначный код.' });
      }

      const user = await db.findUserByEmail(normalisedEmail);
      if (!user) {
        return res.status(410).json({ code: 'expired', message: 'Срок кода истёк. Запросите новый.' });
      }

      if (user.is_blocked === true) {
        return res.status(403).json({
          code: 'account_blocked',
          message: 'Аккаунт заблокирован администратором.',
        });
      }

      await checkCode(user, code);
      await db.markEmailVerified(user.id);
      await db.touchLogin(user.id);

      // Владелец площадки — суперадмин при любом сценарии входа.
      if (user.email === OWNER_EMAIL && user.is_admin !== true) {
        await db.setAdmin(user.id, true);
      }

      const fresh = await db.findUserById(user.id);

      // Страховка на случай, если профиль не создался на шаге регистрации.
      try {
        if (fresh.role === 'developer') {
          const profile = await market.getDevProfile(fresh.id);
          if (!profile) await market.upsertDevProfile(fresh.id, {});
        } else {
          const profile = await market.getClientProfile(fresh.id);
          if (!profile) await market.upsertClientProfile(fresh.id, {});
        }
      } catch (profileError) {
        console.warn('Не удалось дозаполнить профиль:', profileError.message);
      }

      issueSession(res, fresh);
      return res.json({ user: publicUser(fresh) });
    } catch (error) {
      return fail(res, error);
    }
  });

  /* --- resend code --------------------------------------------------- */
  app.post('/api/auth/resend-code', codeLimiter, async (req, res) => {
    try {
      const normalisedEmail = normaliseEmail(req.body?.email);
      if (!normalisedEmail) {
        return res.status(400).json({ code: 'bad_email', message: 'Введите корректный адрес почты.' });
      }
      const user = await db.findUserByEmail(normalisedEmail);
      // Never reveal whether the address exists.
      if (!user || user.email_verified) {
        return res.json({ status: 'verification_sent', resendAfterSeconds: RESEND_COOLDOWN_SECONDS });
      }
      const result = await issueCode(user, {
        intro: 'Вот новый код для подтверждения вашей почты.',
      });
      return res.json({ status: 'verification_sent', email: user.email, ...result });
    } catch (error) {
      return fail(res, error);
    }
  });

  /* --- login --------------------------------------------------------- */
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const normalisedEmail = normaliseEmail(email);
      if (!normalisedEmail || typeof password !== 'string' || !password) {
        return res
          .status(400)
          .json({ code: 'bad_credentials', message: 'Введите почту и пароль.' });
      }

      const user = await db.findUserByEmail(normalisedEmail);
      // Same message and comparable timing whether or not the account exists.
      const passwordOk = user
        ? await verifyPassword(password, user.password_hash)
        : await verifyPassword(password, await hashPassword('decoy-value-for-timing'));

      if (!user || !passwordOk) {
        return res
          .status(401)
          .json({ code: 'bad_credentials', message: 'Почта или пароль неверные.' });
      }

      if (user.is_blocked === true) {
        return res.status(403).json({
          code: 'account_blocked',
          message: user.blocked_reason
            ? `Аккаунт заблокирован: ${user.blocked_reason}`
            : 'Аккаунт заблокирован администратором. Напишите в поддержку.',
        });
      }

      if (!user.email_verified) {
        let sent = {};
        try {
          sent = await issueCode(user, {
            intro: 'Confirm your email address to finish signing in.',
          });
        } catch (codeError) {
          // Кулдаун — не ошибка: предыдущий код ещё жив, ведём на экран ввода.
          if (codeError.code === 'cooldown') {
            sent = { retryAfter: codeError.retryAfter };
          } else if (codeError.code === 'email_delivery_failed') {
            // А вот несработавшая почта — ошибка, и о ней надо сказать прямо,
            // иначе человек будет ждать письмо, которого не будет.
            return res.status(codeError.status ?? 502).json({
              code: 'email_delivery_failed',
              message: codeError.message,
            });
          } else {
            throw codeError;
          }
        }
        return res.status(403).json({
          code: 'email_unverified',
          email: user.email,
          message: 'Сначала подтвердите почту — мы отправили код.',
          ...sent,
        });
      }

      await db.touchLogin(user.id);
      if (user.email === OWNER_EMAIL && user.is_admin !== true) await db.setAdmin(user.id, true);
      const fresh = (await db.findUserById(user.id)) ?? user;
      issueSession(res, fresh);
      return res.json({ user: publicUser(fresh) });
    } catch (error) {
      return fail(res, error);
    }
  });

  /* --- logout -------------------------------------------------------- */
  app.post('/api/auth/logout', (req, res) => {
    clearSession(res);
    return res.json({ ok: true });
  });

  /* --- смена роли: намеренно запрещена -------------------------------- */

  /**
   * Роль выбирается один раз. Маршрут существует, чтобы у клиента был
   * честный ответ вместо 404 и чтобы намерение было видно в коде.
   */
  app.post('/api/auth/role', requireAuth, async (req, res) => {
    return res.status(403).json({
      code: 'role_locked',
      message:
        'Роль выбирается один раз при регистрации и не меняется. Если это ошибка — напишите администратору площадки.',
    });
  });

  /* --- current user -------------------------------------------------- */
  app.get('/api/auth/me', async (req, res) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.status(401).json({ code: 'unauthenticated', message: 'Вы не вошли в аккаунт.' });
      }
      const user = await db.findUserById(session.sub);
      if (!user || !user.email_verified) {
        clearSession(res);
        return res.status(401).json({ code: 'unauthenticated', message: 'Вы не вошли в аккаунт.' });
      }
      if (user.is_blocked === true) {
        return res.status(403).json({
          code: 'account_blocked',
          message: user.blocked_reason
            ? `Аккаунт заблокирован: ${user.blocked_reason}`
            : 'Аккаунт заблокирован администратором.',
        });
      }
      return res.json({ user: publicUser(user) });
    } catch (error) {
      return fail(res, error);
    }
  });
}

export const AUTH_CONSTANTS = {
  SESSION_COOKIE,
  RESEND_COOLDOWN_SECONDS,
  MAX_CODE_ATTEMPTS,
  CODE_TTL_MS,
};
