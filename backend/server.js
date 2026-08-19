import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as db from './db.js';
import { EMAIL_MODE, EMAIL_DESCRIPTION, MAIL_CONFIGURED, verifyMailTransport } from './mailer.js';
import { registerAuthRoutes, requireAuth, ensureSuperAdmin, OWNER_EMAIL } from './auth.js';
import { registerHubRoutes, SEED_DEVELOPERS } from './hub.js';
import * as marketDb from './market-db.js';
import { registerMarketRoutes } from './market.js';
import { registerAdminRoutes } from './admin.js';
import { ensureSeedOffers, ROTATION_DAYS } from './offers.js';

const PORT = Number(process.env.PORT ?? 4000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Comma-separated list. In production an empty list means "reject everything",
// which is the safe failure mode for a CORS allowlist.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render terminates TLS in front of the app.
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// credentials:true is required — the session travels in an httpOnly cookie.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin / server-to-server
      if (!IS_PRODUCTION && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  })
);

/* ------------------------------------------------------------------ */
/* Rate limits                                                         */
/* ------------------------------------------------------------------ */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' },
});

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' },
});

/* ------------------------------------------------------------------ */
/* Storage readiness                                                   */
/* ------------------------------------------------------------------ */

// The server starts listening immediately and connects to the database in the
// background. A database that is unreachable then shows up as a clear 503 and
// a readable /health payload, instead of every request hanging until the
// browser gives up.
const storage = { ready: false, error: null };

/**
 * Состояние почты. Проверяется один раз при старте, чтобы про неверный
 * пароль стало известно сразу, а не в момент первой регистрации.
 */
const mail = { configured: MAIL_CONFIGURED, ready: false, error: null };

function requireStorage(_req, res, next) {
  if (storage.ready) return next();
  return res.status(503).json({
    code: 'storage_unavailable',
    message: storage.error
      ? 'The service cannot reach its database. Please try again shortly.'
      : 'The service is still starting. Please try again in a moment.',
  });
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.status(storage.ready || db.DB_MODE === 'memory' ? 200 : 503).json({
    status: storage.ready ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    env: NODE_ENV,
    storage: storage.ready ? db.DB_MODE : storage.error ? 'error' : 'connecting',
    storageError: storage.error,
    email: {
      mode: EMAIL_MODE,
      configured: mail.configured,
      ready: mail.ready,
      error: mail.error,
    },
    emailMode: EMAIL_MODE,
    timestamp: new Date().toISOString(),
  });
});

/** Lets the UI describe the environment honestly (e.g. dev codes on screen). */
app.get('/api/capabilities', (_req, res) => {
  res.json({
    // «Можно ли вообще зарегистрироваться» — это про доставку письма.
    email: mail.ready,
    emailMode: EMAIL_MODE,
    emailError: mail.ready ? null : mail.error,
    storage: db.DB_MODE,
    market: { rotationDays: ROTATION_DAYS, ownerEmail: OWNER_EMAIL },
  });
});

app.use('/api/auth', requireStorage);
app.use('/api/proposal', requireStorage);
app.use('/api/hub', requireStorage);
app.use('/api/market', requireStorage);
app.use('/api/admin', requireStorage);

registerAuthRoutes(app, { authLimiter, codeLimiter });
registerHubRoutes(app);
registerMarketRoutes(app);
registerAdminRoutes(app);

/** Recording acceptance now depends on the session, not on a one-time code. */
app.post('/api/proposal/accept', requireAuth, async (req, res) => {
  try {
    const { proposalId, total, currency, lines } = req.body ?? {};
    if (typeof proposalId !== 'string' || !Number.isFinite(Number(total))) {
      return res.status(400).json({ code: 'bad_input', message: 'Invalid acceptance payload.' });
    }

    const record = await db.recordAcceptance({
      userId: req.session.sub,
      proposalId: proposalId.slice(0, 64),
      totalCents: Math.round(Number(total) * 100),
      currency: typeof currency === 'string' ? currency.slice(0, 8) : 'USD',
      lineItems: Array.isArray(lines) ? lines.slice(0, 200) : [],
    });

    return res.json({ recorded: true, acceptedAt: record.accepted_at });
  } catch (error) {
    console.error('Acceptance error:', error);
    return res.status(500).json({ code: 'server_error', message: 'Could not record acceptance.' });
  }
});

app.get('/api/proposal/acceptance', requireAuth, async (req, res) => {
  try {
    const record = await db.latestAcceptance({
      userId: req.session.sub,
      proposalId: String(req.query?.proposalId ?? '').slice(0, 64),
    });
    return res.json({ acceptance: record ? { acceptedAt: record.accepted_at } : null });
  } catch (error) {
    console.error('Acceptance lookup error:', error);
    return res.status(500).json({ code: 'server_error', message: 'Could not read acceptance.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.message?.startsWith('Origin not allowed')) {
    return res.status(403).json({ code: 'origin_forbidden', message: 'Origin not allowed.' });
  }
  console.error('Unhandled error:', error);
  return res.status(500).json({ code: 'server_error', message: 'Something went wrong.' });
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function start() {
  // Fail fast on a misconfiguration we can detect without any I/O.
  db.assertStorageAllowed();

  app.listen(PORT, () => {
    console.info(`Proposal API listening on :${PORT} (${NODE_ENV})`);
    console.info(`Storage:         ${db.DB_MODE} (connecting…)`);
    console.info(`Email transport: ${EMAIL_DESCRIPTION}`);
    if (db.DB_MODE === 'memory') {
      console.warn('No DATABASE_URL — accounts live in memory and vanish on restart.');
    }
    if (!MAIL_CONFIGURED) {
      console.warn('Почтовый провайдер не настроен — регистрация будет отвечать ошибкой.');
    }
    if (!process.env.JWT_SECRET) {
      // Секретом подписывается сессия И хешируются коды подтверждения.
      // Случайный секрет на каждый запуск означает, что при перезапуске
      // сервера (в том числе автоматическом, из-за node --watch) любой
      // выданный код мгновенно перестаёт подходить.
      console.warn('———————————————————————————————————————————————');
      console.warn('JWT_SECRET не задан. Секрет сгенерирован случайно, поэтому');
      console.warn('каждый перезапуск сервера обнуляет сессии И делает недействительными');
      console.warn('все выданные коды подтверждения. Задайте JWT_SECRET в backend/.env.');
      console.warn('———————————————————————————————————————————————');
    }
    if (IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) {
      console.warn('ALLOWED_ORIGINS is empty — every cross-origin browser request will be rejected.');
    }
    console.info(`CORS allowlist:  ${ALLOWED_ORIGINS.join(', ') || '(empty)'}`);
  });

  // Почта проверяется параллельно с базой — она не блокирует запуск, но её
  // состояние должно быть известно до первой регистрации.
  verifyMailTransport()
    .then((result) => {
      mail.ready = result.ok;
      mail.error = result.error;
      if (result.ok) {
        console.info(`Почта готова:    ${EMAIL_DESCRIPTION}`);
      } else {
        console.error('———————————————————————————————————————————————');
        console.error('ПОЧТА НЕ РАБОТАЕТ — регистрация будет отклоняться.');
        console.error(result.error);
        console.error('Задайте в backend/.env: SMTP_HOST, SMTP_PORT, SMTP_USER,');
        console.error('SMTP_PASS, SMTP_SECURE и MAIL_FROM — и перезапустите сервер.');
        console.error('———————————————————————————————————————————————');
      }
    })
    .catch((error) => {
      mail.ready = false;
      mail.error = error.message;
      console.error('Проверка почты не удалась:', error.message);
    });

  try {
    const { mode } = await db.initDb();
    storage.ready = true;
    console.info(`Storage ready:   ${mode}`);

    // Доска исполнителей должна быть непустой с первого запроса.
    try {
      const count = await db.ensureSeedDevelopers(SEED_DEVELOPERS);
      console.info(`Исполнителей в Центре: ${count}`);
    } catch (seedError) {
      console.warn('Не удалось засеять исполнителей:', seedError.message);
    }

    // Биржа: схема, пул предложений и права владельца площадки.
    try {
      await marketDb.initMarketDb();
      const offerCount = await ensureSeedOffers();
      console.info(`Биржа готова · предложений в пуле: ${offerCount} · ротация раз в ${ROTATION_DAYS} дн.`);
    } catch (marketError) {
      console.error('Не удалось поднять схему биржи:', marketError.message);
    }

    try {
      const owner = await ensureSuperAdmin();
      console.info(
        owner.present
          ? `Суперадминистратор: ${owner.email}`
          : `Суперадминистратор: ${owner.email} (аккаунт ещё не зарегистрирован — права выдадутся при регистрации)`
      );
    } catch (ownerError) {
      console.warn('Не удалось назначить суперадминистратора:', ownerError.message);
    }
  } catch (error) {
    storage.error = error.message;
    console.error('DATABASE CONNECTION FAILED:', error.message);
    console.error('The API is listening but every data route will answer 503 until this is fixed.');
    console.error('Check DATABASE_URL — it must be a direct postgresql:// connection string.');
  }
}

start().catch((error) => {
  console.error('Failed to start:', error.message);
  process.exit(1);
});

export default app;