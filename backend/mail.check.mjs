/**
 * Диагностика почты. Отвечает по очереди на вопросы «принимают ли наш ключ»,
 * «подтверждён ли отправитель» и «уходит ли настоящее письмо», и по каждому
 * говорит, что именно делать:
 *
 *   node backend/mail.check.mjs kimdir@gmail.com
 *
 * Проверяется тот транспорт, который реально настроен: если задан
 * BREVO_API_KEY — HTTP API Brevo, иначе SMTP-релей. Секрет не печатается:
 * только длина и префикс, чтобы отличить SMTP-ключ от API-ключа.
 */
import 'dotenv/config';
import net from 'node:net';
import tls from 'node:tls';

const to = process.argv[2];

const BREVO_API_KEY = (process.env.BREVO_API_KEY ?? '').trim();
const HOST = process.env.SMTP_HOST ?? '';
const PORT = Number(process.env.SMTP_PORT ?? 587);
const USER = process.env.SMTP_USER ?? '';
const PASS = process.env.SMTP_PASS ?? '';
const FROM = process.env.MAIL_FROM ?? '';
const IS_BREVO = HOST.includes('brevo');

const FROM_ADDRESS = (FROM.match(/<\s*([^>]+?)\s*>/)?.[1] ?? FROM).trim();

const line = () => console.log('─'.repeat(62));

function secretHint(value) {
  return value ? `${value.length} символов, начинается на «${value.slice(0, 9)}»` : '— не задан';
}

console.log('');
line();
console.log('  НАСТРОЙКИ');
line();
console.log(`  BREVO_API_KEY  ${secretHint(BREVO_API_KEY)}`);
console.log(`  SMTP_HOST      ${HOST || '— не задан'}`);
console.log(`  SMTP_PORT      ${PORT}`);
console.log(`  SMTP_USER      ${USER || '— не задан'}`);
console.log(`  SMTP_PASS      ${secretHint(PASS)}`);
console.log(`  MAIL_FROM      ${FROM || '— не задан'}`);

/* ------------------------------------------------------------------ */
/* Отправка проверочного письма — общий финал для обеих веток          */
/* ------------------------------------------------------------------ */

async function sendTestLetter(hints) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.log('');
    line();
    console.log('  Настройки в порядке. Чтобы отправить проверочное письмо:');
    console.log('    node backend/mail.check.mjs kimdir@gmail.com');
    line();
    process.exit(0);
  }

  console.log('');
  line();
  console.log('  ОТПРАВКА ПИСЬМА');
  line();

  const { sendCodeEmail } = await import('./mailer.js');
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

  try {
    await sendCodeEmail({
      to,
      code,
      name: 'Проверка настроек',
      intro: 'Это тестовое письмо. Если вы его видите — доставка кода работает.',
    });
    console.log(`  ✔ Письмо принято провайдером. Код в письме: ${code}`);
    console.log(`  Получатель: ${to}`);
    console.log('  Нет во «Входящих» — посмотрите «Спам» и «Промоакции».');
    line();
    process.exit(0);
  } catch (error) {
    console.log(`  ✘ Письмо не ушло: ${error.reason ?? error.message}`);
    for (const hint of hints ?? []) console.log(`    ${hint}`);
    line();
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Ветка 1: HTTP API Brevo                                             */
/* ------------------------------------------------------------------ */

if (BREVO_API_KEY) {
  console.log('');
  line();
  console.log('  ТРАНСПОРТ: HTTP API Brevo (api.brevo.com, порт 443)');
  line();

  if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
    console.log('  ✘ Это SMTP-ключ (xsmtpsib-…), а HTTP API нужен API-ключ (xkeysib-…).');
    console.log('    Возьмите его здесь: https://app.brevo.com/settings/keys/api');
    process.exit(1);
  }

  async function brevo(path) {
    const response = await fetch(`https://api.brevo.com/v3${path}`, {
      headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message ?? `Brevo ответил ${response.status}`);
    }
    return payload ?? {};
  }

  console.log('');
  console.log('  1. КЛЮЧ');
  try {
    const account = await brevo('/account');
    const plan = account.plan?.[0];
    console.log(`  ✔ Ключ принят · аккаунт ${account.email}`);
    if (plan) console.log(`    тариф ${plan.type}, лимит ${plan.credits} писем`);
  } catch (error) {
    console.log(`  ✘ Ключ не принят: ${error.message}`);
    console.log('    Создайте новый: https://app.brevo.com/settings/keys/api');
    process.exit(1);
  }

  console.log('');
  console.log('  2. ОТПРАВИТЕЛЬ');
  try {
    const { senders = [] } = await brevo('/senders');
    const found = senders.find(
      (sender) => String(sender.email ?? '').toLowerCase() === FROM_ADDRESS.toLowerCase()
    );
    if (!found) {
      console.log(`  ✘ ${FROM_ADDRESS} не заведён отправителем в Brevo.`);
      console.log(
        `    Подтверждённые сейчас: ${senders.map((sender) => sender.email).join(', ') || '— ни одного'}`
      );
      console.log('    Добавьте адрес: https://app.brevo.com/senders/list');
      process.exit(1);
    }
    if (found.active === false) {
      console.log(`  ✘ ${FROM_ADDRESS} заведён, но не подтверждён — откройте письмо от Brevo.`);
      process.exit(1);
    }
    console.log(`  ✔ ${FROM_ADDRESS} подтверждён (${found.name})`);
  } catch (error) {
    console.log(`  ⚠ Не удалось прочитать список отправителей: ${error.message}`);
    console.log('    Отправку это не запрещает — проверим письмом.');
  }

  await sendTestLetter([
    '· адрес отправителя проверяется на https://app.brevo.com/senders/list',
    '· аккаунт мог остаться на проверке — Brevo пишет об этом письмом',
  ]);
}

/* ------------------------------------------------------------------ */
/* Ветка 2: SMTP-релей                                                 */
/* ------------------------------------------------------------------ */

if (!HOST || !USER || !PASS) {
  console.log('');
  console.log('  Почта не настроена. Самый быстрый путь — HTTP API Brevo:');
  console.log('    1. https://app.brevo.com/settings/keys/api → создайте ключ (xkeysib-…)');
  console.log('    2. положите его в BREVO_API_KEY');
  console.log('    3. в MAIL_FROM поставьте адрес, подтверждённый на');
  console.log('       https://app.brevo.com/senders/list');
  console.log('');
  console.log('  Альтернатива — SMTP: SMTP_HOST + SMTP_USER + SMTP_PASS.');
  console.log('  Учтите, что многие хостинги (в том числе Render) режут исходящий SMTP.');
  process.exit(1);
}

console.log('');
line();
console.log('  ТРАНСПОРТ: SMTP-релей');
line();

if (IS_BREVO && PASS.startsWith('xkeysib-')) {
  console.log('');
  console.log('  ✘ В SMTP_PASS лежит API-ключ Brevo (xkeysib-…).');
  console.log('    Релею нужен SMTP-ключ (xsmtpsib-…):');
  console.log('    https://app.brevo.com/settings/keys/smtp → Generate a new SMTP key');
  console.log('    Либо переключитесь на HTTP API: положите этот ключ в BREVO_API_KEY.');
  process.exit(1);
}

/* --- 1. Порты ------------------------------------------------------- */

function readReply(socket, ms = 15000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('сервер не ответил вовремя')), ms);
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (/^\d{3} /.test(lines[lines.length - 1] ?? '')) {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        resolve(buffer.trim());
      }
    };
    socket.on('data', onData);
  });
}

function say(socket, command) {
  const reply = readReply(socket);
  socket.write(command + '\r\n');
  return reply;
}

async function connect(port, ms = 12000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port, timeout: ms });
    socket.once('connect', () => {
      socket.setTimeout(0);
      resolve(socket);
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('порт не отвечает — закрыт или блокируется'));
    });
    socket.once('error', reject);
  });
}

const CANDIDATES = [...new Set([PORT, 587, 2525, 465])];
const reachable = [];

console.log('');
console.log('  1. ДОСТУПНОСТЬ ПОРТОВ');

for (const port of CANDIDATES) {
  try {
    const socket = await connect(port);
    socket.destroy();
    reachable.push(port);
    console.log(`  ✔ ${HOST}:${port} — открыт${port === PORT ? '  ← используется сейчас' : ''}`);
  } catch (error) {
    console.log(`  ✘ ${HOST}:${port} — ${error.message}${port === PORT ? '  ← используется сейчас' : ''}`);
  }
}

if (!reachable.length) {
  console.log('');
  console.log('  Ни один порт недоступен. Почти всегда это firewall, антивирус,');
  console.log('  провайдер или хостинг, который режет исходящий SMTP.');
  console.log('  На Render и подобных площадках SMTP закрыт целиком — там');
  console.log('  единственный рабочий путь это HTTP API: задайте BREVO_API_KEY');
  console.log('  (ключ xkeysib-… со страницы https://app.brevo.com/settings/keys/api).');
  process.exit(1);
}

if (!reachable.includes(PORT)) {
  console.log('');
  console.log(`  Порт ${PORT} закрыт, но ${reachable[0]} открыт.`);
  console.log(`  Поставьте в backend/.env:  SMTP_PORT=${reachable[0]}`);
  console.log(`                             SMTP_SECURE=${reachable[0] === 465}`);
  process.exit(1);
}

/* --- 2. Логин ------------------------------------------------------- */

console.log('');
console.log('  2. ЛОГИН И КЛЮЧ');

let authOk = false;
try {
  const plain = await connect(PORT);
  await readReply(plain); // приветствие

  const ehlo = await say(plain, 'EHLO diagnostic.local');
  let channel = plain;

  if (/STARTTLS/i.test(ehlo)) {
    await say(plain, 'STARTTLS');
    channel = await new Promise((resolve, reject) => {
      const secure = tls.connect({ socket: plain, servername: HOST }, () => resolve(secure));
      secure.once('error', reject);
    });
    await say(channel, 'EHLO diagnostic.local');
    console.log('  ✔ TLS установлен');
  }

  const start = await say(channel, 'AUTH LOGIN');
  if (!start.startsWith('334')) throw new Error(start);
  const step = await say(channel, Buffer.from(USER).toString('base64'));
  if (!step.startsWith('334')) throw new Error(step);
  const result = await say(channel, Buffer.from(PASS).toString('base64'));

  if (result.startsWith('235')) {
    authOk = true;
    console.log('  ✔ Сервер принял логин и ключ');
  } else {
    console.log(`  ✘ Сервер отклонил ключ: ${result.split('\n')[0]}`);
    if (IS_BREVO) {
      console.log('');
      console.log('    Возьмите новый SMTP-ключ и вставьте его в SMTP_PASS:');
      console.log('    https://app.brevo.com/settings/keys/smtp');
      console.log(`    Логин должен остаться прежним: ${USER}`);
    }
  }
  channel.end();
} catch (error) {
  console.log(`  ✘ Не удалось пройти авторизацию: ${error.message}`);
}

if (!authOk) process.exit(1);

/* --- 3. Письмо ------------------------------------------------------ */

await sendTestLetter(
  IS_BREVO
    ? [
        'Логин прошёл, значит ключ верный. Чаще всего дальше мешает одно из двух:',
        `· адрес отправителя не подтверждён — проверьте ${FROM_ADDRESS}`,
        '  на https://app.brevo.com/senders/list',
        '· аккаунт ещё не активирован для транзакционных писем —',
        '  Brevo пишет об этом письмом и просит описать рассылку.',
      ]
    : []
);
