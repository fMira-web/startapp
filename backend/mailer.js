import { Resend } from 'resend';

/**
 * Доставка писем.
 *
 * Транспорт выбирается один раз при старте:
 *   'smtp'   — SMTP_HOST + SMTP_USER + SMTP_PASS. Обычный релей (Brevo,
 *              Gmail с паролем приложения, Яндекс, корпоративный сервер)
 *              доставляет письмо ЛЮБОМУ получателю — это основной режим.
 *   'resend' — RESEND_API_KEY. Без подтверждённого домена Resend работает в
 *              тестовом режиме и принимает письма только на адрес владельца
 *              ключа, поэтому он идёт запасным.
 *   'none'   — ничего не настроено.
 *
 * Код подтверждения — секрет получателя. Он уходит только письмом и никогда
 * не возвращается в ответе API: иначе зарегистрироваться на чужой адрес
 * сможет кто угодно. Если письмо не ушло — это ошибка, а не повод показать
 * код на экране.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
export const MAIL_FROM = process.env.MAIL_FROM ?? 'Toshkent Freelance <no-reply@twstudio.uz>';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO ?? null;

const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_SECURE = (process.env.SMTP_SECURE ?? String(SMTP_PORT === 465)) === 'true';

/**
 * Локальная разработка без провайдера: код печатается В КОНСОЛЬ СЕРВЕРА и
 * никуда больше. По умолчанию выключено — без почты регистрация честно
 * не работает, вместо того чтобы делать вид, что работает.
 */
const ALLOW_DEV_CODES = process.env.ALLOW_DEV_EMAIL_CODES === '1';

/** Отправка не должна висеть дольше этого — иначе запрос уходит в таймаут. */
const SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS ?? 20_000);

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const SMTP_READY = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const MAIL_PRIMARY = (process.env.MAIL_PRIMARY ?? '').trim().toLowerCase();
const PREFER_RESEND = MAIL_PRIMARY === 'resend' || !SMTP_READY;

export const EMAIL_MODE = SMTP_READY && !PREFER_RESEND ? 'smtp' : resend ? 'resend' : SMTP_READY ? 'smtp' : 'none';
export const MAIL_CONFIGURED = EMAIL_MODE !== 'none';
export const EMAIL_DESCRIPTION =
  EMAIL_MODE === 'smtp'
    ? `smtp через ${SMTP_HOST}:${SMTP_PORT} (${SMTP_USER})`
    : EMAIL_MODE === 'resend'
      ? 'resend'
      : ALLOW_DEV_CODES
        ? 'не настроен · ALLOW_DEV_EMAIL_CODES=1, код печатается в консоль'
        : 'не настроен · регистрация будет отвечать ошибкой';

/**
 * Последний код, выданный в режиме ALLOW_DEV_EMAIL_CODES. Существует ровно
 * для автотестов, которым иначе неоткуда взять код. По HTTP не отдаётся
 * никогда и остаётся пустым, пока режим выключен.
 */
export const lastDevCodes = new Map();

/* ------------------------------------------------------------------ */
/* Транспорт                                                           */
/* ------------------------------------------------------------------ */

let smtpTransport = null;
async function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const { default: nodemailer } = await import('nodemailer');
  smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Без этих таймаутов неверный пароль или закрытый порт превращаются в
    // висящий запрос: браузер отваливается по своему таймауту, а человек
    // видит «сервер долго отвечает» вместо понятной причины.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return smtpTransport;
}

/** Обещание, которое обязано уложиться в срок. */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label}: превышено время ожидания (${Math.round(ms / 1000)} с)`);
      error.code = 'mail_timeout';
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Проверка транспорта при старте сервера.
 *
 * Смысл — узнать про неверный пароль сразу, а не в момент, когда первый
 * человек нажмёт «Зарегистрироваться».
 */
export async function verifyMailTransport() {
  if (EMAIL_MODE === 'none') {
    return {
      ok: false,
      mode: 'none',
      error: ALLOW_DEV_CODES
        ? 'Провайдер не настроен. ALLOW_DEV_EMAIL_CODES=1 — код печатается в консоль сервера.'
        : 'Провайдер не настроен: задайте SMTP_HOST + SMTP_USER + SMTP_PASS или RESEND_API_KEY.',
    };
  }

  if (EMAIL_MODE === 'smtp' || SMTP_READY) {
    try {
      const transport = await getSmtpTransport();
      await withTimeout(transport.verify(), 15_000, 'проверка SMTP');
      return { ok: true, mode: 'smtp', error: null };
    } catch (error) {
      return { ok: false, mode: 'smtp', error: describeSmtpError(error) };
    }
  }

  // У Resend нет дешёвой проверки ключа — считаем настроенным по факту ключа.
  return { ok: Boolean(resend), mode: 'resend', error: resend ? null : 'RESEND_API_KEY пуст.' };
}

/** Человеческое объяснение самых частых отказов SMTP. */
function describeSmtpError(error) {
  const message = String(error?.message ?? error ?? '');
  const lower = message.toLowerCase();
  const code = String(error?.code ?? '');

  if (code === 'EAUTH' || lower.includes('535') || lower.includes('authentication')) {
    return `Почтовый сервер отклонил логин или пароль (${SMTP_USER}). Для Brevo нужен SMTP-ключ из «SMTP & API», для Gmail — пароль приложения, а не пароль от аккаунта.`;
  }
  if (code === 'ETIMEDOUT' || code === 'mail_timeout' || lower.includes('timed out')) {
    return `Не удалось достучаться до ${SMTP_HOST}:${SMTP_PORT} — порт закрыт или провайдер его блокирует. Попробуйте порт 587 (SMTP_SECURE=false).`;
  }
  if (code === 'ECONNREFUSED') return `${SMTP_HOST}:${SMTP_PORT} отказал в соединении.`;
  if (code === 'ENOTFOUND' || code === 'EDNS') return `Хост ${SMTP_HOST} не найден — проверьте SMTP_HOST.`;
  if (lower.includes('sender') && lower.includes('not') ) {
    return `Адрес отправителя ${MAIL_FROM} не подтверждён у провайдера. Подтвердите его в кабинете и повторите.`;
  }
  return message || 'Неизвестная ошибка SMTP.';
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
  );
}

function codeEmailHtml({ code, name, intro }) {
  const greeting = name ? `Здравствуйте, ${escapeHtml(name)}!` : 'Здравствуйте!';
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:32px 16px;background:#f9fafb;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e8eaee;border-radius:14px;">
      <tr>
        <td style="padding:32px 32px 8px 32px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#55637a;">Подтверждение почты</p>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">Ваш код подтверждения</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 0 32px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(intro)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0 32px;">
          <div style="background:#f3f4f6;border:1px solid #e8eaee;border-radius:10px;padding:20px;text-align:center;">
            <span style="font-size:34px;font-weight:600;letter-spacing:0.34em;font-variant-numeric:tabular-nums;color:#1e3a5f;">${code}</span>
          </div>
          <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#55637a;text-align:center;">Код действует 10 минут и используется один раз.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 32px 32px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#55637a;">
            Если вы это не запрашивали, просто проигнорируйте письмо: аккаунт не активируется и подпись не записывается.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Ошибки, после которых бессмысленно повторять попытку для этого адреса:
 * провайдер в тестовом режиме, домен не подтверждён, адрес в подавленных.
 * Их отличает то, что виноват не адрес человека, а настройка отправителя.
 */
function describeDeliveryBlock(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  const status = Number(error?.statusCode ?? error?.status ?? 0);

  if (message.includes('only send testing emails') || message.includes('testing email')) {
    return 'Почтовый провайдер работает в тестовом режиме и принимает письма только на адрес владельца ключа. Подтвердите домен в Resend, чтобы код уходил всем.';
  }
  if (message.includes('domain is not verified') || message.includes('verify a domain')) {
    return 'Домен отправителя не подтверждён у почтового провайдера, поэтому письмо не ушло.';
  }
  if (message.includes('suppress')) {
    return 'Этот адрес в списке подавленных у почтового провайдера.';
  }
  if (status === 401 || status === 403 || message.includes('api key')) {
    return 'Почтовый провайдер отклонил ключ доступа, письмо не отправлено.';
  }
  return null;
}

/**
 * Отправляет код на почту.
 *
 * Возвращает `{}` при успехе и БРОСАЕТ ошибку, если письмо не ушло. Код
 * наружу не отдаётся ни при каких настройках — единственный канал доставки
 * это письмо.
 *
 * @param {{ to: string, code: string, name?: string, intro?: string }} input
 * @returns {Promise<{}>}
 */
export async function sendCodeEmail({ to, code, name, intro }) {
  const subject = `${code} — ваш код подтверждения`;
  const body = intro ?? 'Введите код ниже, чтобы подтвердить почту и завершить вход.';
  const html = codeEmailHtml({ code, name, intro: body });
  const text = `${body}\n\nВаш код: ${code}. Он действует 10 минут.`;

  const payload = {
    from: MAIL_FROM,
    subject,
    html,
    text,
    ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
  };

  let lastProblem = null;

  const trySmtp = async () => {
    const transport = await getSmtpTransport();
    await withTimeout(transport.sendMail({ ...payload, to }), SEND_TIMEOUT_MS, 'отправка письма');
    console.info(`[mail] код отправлен на ${to} через ${SMTP_HOST}`);
    return {};
  };

  const tryResend = async () => {
    const { error } = await withTimeout(
      resend.emails.send({ ...payload, to: [to] }),
      SEND_TIMEOUT_MS,
      'отправка письма'
    );
    if (error) {
      throw Object.assign(new Error(error.message ?? 'Email delivery failed'), {
        statusCode: error.statusCode ?? error.name,
      });
    }
    console.info(`[mail] код отправлен на ${to} через resend`);
    return {};
  };

  // Основной транспорт — тот, что доставит письмо кому угодно.
  if (SMTP_READY && !PREFER_RESEND) {
    try {
      return await trySmtp();
    } catch (error) {
      lastProblem = error;
      console.error(`[mail] smtp не доставил письмо на ${to}:`, error?.message ?? error);
    }
  }

  if (resend) {
    try {
      return await tryResend();
    } catch (error) {
      lastProblem = error;
      console.error(`[mail] resend не доставил письмо на ${to}:`, error?.message ?? error);
    }
  }

  // Запасной заход через почтовый ящик, если основным был Resend.
  if (SMTP_READY && PREFER_RESEND) {
    try {
      return await trySmtp();
    } catch (error) {
      lastProblem = error;
      console.error(`[mail] smtp не доставил письмо на ${to}:`, error?.message ?? error);
    }
  }

  // Локальная работа без провайдера — только по явному разрешению и только
  // в консоль сервера. В браузер код не попадает никогда.
  if (!MAIL_CONFIGURED && ALLOW_DEV_CODES) {
    lastDevCodes.set(to, code);
    console.info(
      `\n  ┌─ ALLOW_DEV_EMAIL_CODES ─────────────────\n  │  to:   ${to}\n  │  code: ${code}\n  └─────────────────────────────────────────\n`
    );
    return {};
  }

  // Письмо не ушло — это отказ, а не повод показать код на экране.
  const reason = lastProblem
    ? (describeDeliveryBlock(lastProblem) ?? describeSmtpError(lastProblem))
    : 'Почтовый провайдер не настроен: задайте SMTP_HOST + SMTP_USER + SMTP_PASS или RESEND_API_KEY.';

  console.error(`[mail] код для ${to} НЕ доставлен: ${reason}`);

  const error = new Error(
    MAIL_CONFIGURED
      ? 'Не удалось отправить письмо с кодом. Проверьте адрес и попробуйте ещё раз через минуту.'
      : 'Отправка писем на сервере не настроена, поэтому код выслать некуда. Сообщите администратору площадки.'
  );
  error.status = MAIL_CONFIGURED ? 502 : 503;
  error.code = 'email_delivery_failed';
  error.expose = true;
  error.reason = reason;
  throw error;
}
