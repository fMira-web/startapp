/**
 * Диагностика почты. Отвечает на три вопроса подряд и по каждому говорит,
 * что именно делать:
 *
 *   1. открыт ли порт до почтового сервера;
 *   2. принимает ли сервер логин и ключ;
 *   3. уходит ли настоящее письмо.
 *
 *   node backend/mail.check.mjs kimdir@gmail.com
 *
 * Секрет не печатается: только длина и префикс, чтобы отличить SMTP-ключ
 * от API-ключа.
 */
import 'dotenv/config';
import net from 'node:net';
import tls from 'node:tls';

const to = process.argv[2];

const HOST = process.env.SMTP_HOST ?? '';
const PORT = Number(process.env.SMTP_PORT ?? 587);
const USER = process.env.SMTP_USER ?? '';
const PASS = process.env.SMTP_PASS ?? '';
const FROM = process.env.MAIL_FROM ?? '';
const IS_BREVO = HOST.includes('brevo');

const line = () => console.log('─'.repeat(62));

console.log('');
line();
console.log('  НАСТРОЙКИ');
line();
console.log(`  SMTP_HOST   ${HOST || '— не задан'}`);
console.log(`  SMTP_PORT   ${PORT}`);
console.log(`  SMTP_USER   ${USER || '— не задан'}`);
console.log(`  SMTP_PASS   ${PASS ? `${PASS.length} символов, начинается на «${PASS.slice(0, 9)}»` : '— не задан'}`);
console.log(`  MAIL_FROM   ${FROM || '— не задан'}`);

if (!HOST || !USER || !PASS) {
  console.log('');
  console.log('  Не хватает SMTP_HOST / SMTP_USER / SMTP_PASS в backend/.env.');
  process.exit(1);
}

if (IS_BREVO && PASS.startsWith('xkeysib-')) {
  console.log('');
  console.log('  ✘ В SMTP_PASS лежит API-ключ Brevo (xkeysib-…).');
  console.log('    Релею нужен SMTP-ключ (xsmtpsib-…):');
  console.log('    https://app.brevo.com/settings/keys/smtp → Generate a new SMTP key');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 1. Порты                                                            */
/* ------------------------------------------------------------------ */

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
line();
console.log('  1. ДОСТУПНОСТЬ ПОРТОВ');
line();

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
  console.log('  Ни один порт недоступен. Почти всегда это firewall, антивирус');
  console.log('  или провайдер, который режет исходящий SMTP.');
  console.log('  Что попробовать: отключить проверку почты в антивирусе,');
  console.log('  проверить сеть без VPN, либо развернуть бэкенд на хостинге.');
  process.exit(1);
}

if (!reachable.includes(PORT)) {
  console.log('');
  console.log(`  Порт ${PORT} закрыт, но ${reachable[0]} открыт.`);
  console.log(`  Поставьте в backend/.env:  SMTP_PORT=${reachable[0]}`);
  console.log(`                             SMTP_SECURE=${reachable[0] === 465}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 2. Логин                                                            */
/* ------------------------------------------------------------------ */

console.log('');
line();
console.log('  2. ЛОГИН И КЛЮЧ');
line();

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

/* ------------------------------------------------------------------ */
/* 3. Письмо                                                           */
/* ------------------------------------------------------------------ */

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
console.log('  3. ОТПРАВКА ПИСЬМА');
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
  console.log(`  ✔ Письмо принято сервером. Код в письме: ${code}`);
  console.log(`  Получатель: ${to}`);
  console.log('  Нет во «Входящих» — посмотрите «Спам» и «Промоакции».');
  line();
  process.exit(0);
} catch (error) {
  console.log(`  ✘ Письмо не ушло: ${error.reason ?? error.message}`);
  if (IS_BREVO) {
    console.log('');
    console.log('    Логин прошёл, значит ключ верный. Чаще всего дальше мешает одно из двух:');
    console.log(`    · адрес отправителя не подтверждён — проверьте ${FROM}`);
    console.log('      на https://app.brevo.com/senders/list');
    console.log('    · аккаунт ещё не активирован для транзакционных писем —');
    console.log('      Brevo пишет об этом письмом и просит описать рассылку.');
  }
  line();
  process.exit(1);
}
