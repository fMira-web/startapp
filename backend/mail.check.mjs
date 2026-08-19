/**
 * Живая проверка доставки: отправляет настоящее письмо с тестовым кодом.
 *
 *   node backend/mail.check.mjs kimdir@gmail.com
 *
 * Нужна, чтобы убедиться в настройках почты, не создавая аккаунт. Проверяет
 * ровно тот путь, которым идёт код подтверждения при регистрации.
 */
import 'dotenv/config';
import { EMAIL_DESCRIPTION, EMAIL_MODE, MAIL_FROM, sendCodeEmail, verifyMailTransport } from './mailer.js';

const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Укажите адрес получателя:  node backend/mail.check.mjs kimdir@gmail.com');
  process.exit(1);
}

console.log(`Транспорт:   ${EMAIL_DESCRIPTION}`);
console.log(`Отправитель: ${MAIL_FROM}`);
console.log(`Получатель:  ${to}\n`);

if (EMAIL_MODE === 'none') {
  console.error('Почта не настроена. Заполните SMTP_PASS в backend/.env и повторите.');
  process.exit(1);
}

const verified = await verifyMailTransport();
if (!verified.ok) {
  console.error('Проверка соединения не прошла:');
  console.error(`  ${verified.error}`);
  process.exit(1);
}
console.log('Соединение и пароль приняты.\n');

const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

try {
  await sendCodeEmail({
    to,
    code,
    name: 'Проверка настроек',
    intro: 'Это тестовое письмо. Если вы его видите — доставка кода работает.',
  });
  console.log(`Письмо отправлено. Код в письме: ${code}`);
  console.log('Если его нет во «Входящих» — проверьте «Спам» и «Промоакции».');
  process.exit(0);
} catch (error) {
  console.error('Письмо не ушло.');
  console.error(`  ${error.reason ?? error.message}`);
  process.exit(1);
}
