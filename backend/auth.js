import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import * as db from './db.js';
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

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name ?? null,
    phone: user.phone ?? null,
    emailVerified: user.email_verified === true,
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

  const delivery = await sendCodeEmail({
    to: user.email,
    code,
    name: user.full_name,
    intro,
  });

  return {
    devCode: delivery.devCode ?? null,
    deliveryNote: delivery.deliveryNote ?? null,
    resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
  };
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

function fail(res, error) {
  const status = error.status ?? 500;
  if (status >= 500) console.error('Auth error:', error);
  return res.status(status).json({
    code: error.code ?? 'server_error',
    message: status >= 500 ? 'Something went wrong. Try again.' : error.message,
    ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export function registerAuthRoutes(app, { authLimiter, codeLimiter }) {
  /* --- register ------------------------------------------------------ */
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { email, password, fullName, phone } = req.body ?? {};

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
          result = { devCode: null, resendAfterSeconds: error.retryAfter ?? RESEND_COOLDOWN_SECONDS };
        }
        return res.status(200).json({
          status: 'verification_sent',
          email: existing.email,
          ...result,
        });
      }

      const user = await db.createUser({
        email: normalisedEmail,
        passwordHash: await hashPassword(password),
        fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim().slice(0, 120) : null,
        phone: cleanPhone,
      });

      const result = await issueCode(user, {
        intro: 'Введите код ниже, чтобы подтвердить почту и активировать аккаунт.',
      });

      return res.status(201).json({ status: 'verification_sent', email: user.email, ...result });
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

      await checkCode(user, code);
      await db.markEmailVerified(user.id);
      await db.touchLogin(user.id);

      const fresh = await db.findUserById(user.id);
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

      if (!user.email_verified) {
        let sent = {};
        try {
          sent = await issueCode(user, {
            intro: 'Confirm your email address to finish signing in.',
          });
        } catch (codeError) {
          if (codeError.code !== 'cooldown') throw codeError;
          sent = { retryAfter: codeError.retryAfter };
        }
        return res.status(403).json({
          code: 'email_unverified',
          email: user.email,
          message: 'Сначала подтвердите почту — мы отправили код.',
          ...sent,
        });
      }

      await db.touchLogin(user.id);
      issueSession(res, user);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      return fail(res, error);
    }
  });

  /* --- logout -------------------------------------------------------- */
  app.post('/api/auth/logout', (req, res) => {
    clearSession(res);
    return res.json({ ok: true });
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
