/**
 * Проверка политики доставки кода.
 *
 * Два утверждения, ради которых этот файл существует:
 *   1. без настроенной почты регистрация ЧЕСТНО отказывает, а не делает вид,
 *      что письмо ушло, и не показывает код на экране;
 *   2. после такого отказа в базе не остаётся аккаунта с email_verified=false,
 *      на который потом невозможно ни войти, ни зарегистрироваться заново.
 *
 *   node mail.test.mjs
 */
process.env.NODE_ENV = 'development';
process.env.PORT = '4311';
process.env.JWT_SECRET = 'mail-test-secret-mail-test-secret';
process.env.OWNER_EMAIL = 'owner@example.uz';
process.env.DATABASE_URL = '';
process.env.BREVO_API_KEY = '';
process.env.RESEND_API_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.MAIL_FROM = '';
// Ключевое отличие от smoke.test.mjs: аварийный режим ВЫКЛЮЧЕН.
process.env.ALLOW_DEV_EMAIL_CODES = '0';

const BASE = `http://127.0.0.1:${process.env.PORT}`;

await import('./server.js');
const db = await import('./db.js');
const { EMAIL_MODE, MAIL_CONFIGURED } = await import('./mailer.js');
await new Promise((resolve) => setTimeout(resolve, 1200));

let passed = 0;
let failed = 0;
const fail = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    fail.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function call(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload ?? {} };
}

console.log('\n— почта не настроена —');
check('режим доставки — none', EMAIL_MODE === 'none' && MAIL_CONFIGURED === false);

const capabilities = await (await fetch(`${BASE}/api/capabilities`)).json();
check('capabilities честно говорят, что почта не работает', capabilities.email === false);

const health = await (await fetch(`${BASE}/health`)).json();
check('health показывает состояние почты', health.email?.configured === false);

const attempt = await call('/api/auth/register', {
  email: 'ddssxs235@gmail.com',
  password: 'long-enough-passphrase-2026',
  fullName: 'Проверка почты',
  role: 'client',
});

check(
  'регистрация отклонена с понятной ошибкой',
  attempt.status === 503 && attempt.body.code === 'email_delivery_failed',
  `${attempt.status} ${JSON.stringify(attempt.body)}`
);
check('сообщение на русском и по делу', String(attempt.body.message ?? '').includes('не настроена'));
check('код в ответе не пришёл', attempt.body.devCode === undefined);

const orphan = await db.findUserByEmail('ddssxs235@gmail.com');
check('в базе не осталось неподтверждённого аккаунта', orphan === null, JSON.stringify(orphan));

const again = await call('/api/auth/register', {
  email: 'ddssxs235@gmail.com',
  password: 'long-enough-passphrase-2026',
  role: 'client',
});
check(
  'повторная попытка не упирается в «почта занята»',
  again.body.code === 'email_delivery_failed',
  JSON.stringify(again.body)
);

const login = await call('/api/auth/login', {
  email: 'ddssxs235@gmail.com',
  password: 'long-enough-passphrase-2026',
});
check('вход по несуществующему аккаунту отклонён', login.status === 401);

console.log(`\n————— пройдено: ${passed}, провалено: ${failed} —————`);
if (failed) console.log('провалы:\n  - ' + fail.join('\n  - '));
process.exit(failed ? 1 : 0);
