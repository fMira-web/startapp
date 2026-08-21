import { Resend } from 'resend';

/**
 * Доставка писем.
 *
 * Доступные транспорты пробуются по очереди, пока письмо не уйдёт:
 *   'brevo'  — BREVO_API_KEY. HTTP API Brevo (api.brevo.com, порт 443).
 *              Основной режим: HTTPS не режется хостингами, в отличие от
 *              SMTP — Render и большинство бесплатных площадок закрывают
 *              исходящие 25/465/587, и именно поэтому письма через
 *              smtp.gmail.com оттуда уходят в таймаут.
 *   'smtp'   — SMTP_HOST + SMTP_USER + SMTP_PASS. Обычный релей. Работает
 *              локально и на хостингах, где SMTP не закрыт.
 *   'resend' — RESEND_API_KEY. Без подтверждённого ДОМЕНА Resend отвечает
 *              «domain is not verified» и письмо не отправляет, поэтому он
 *              идёт последним: Brevo умеет подтверждать отдельный адрес
 *              (в том числе на gmail.com), а Resend — только домен целиком.
 *   'none'   — ничего не настроено.
 *
 * Порядок можно задать вручную: MAIL_PRIMARY=brevo|smtp|resend.
 *
 * Код подтверждения — секрет получателя. Он уходит только письмом и никогда
 * не возвращается в ответе API: иначе зарегистрироваться на чужой адрес
 * сможет кто угодно. Если письмо не ушло — это ошибка, а не повод показать
 * код на экране.
 */

/* ------------------------------------------------------------------ */
/* Настройки                                                           */
/* ------------------------------------------------------------------ */

const BREVO_API_KEY = (process.env.BREVO_API_KEY ?? '').trim();
const BREVO_API = 'https://api.brevo.com/v3';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
export const MAIL_FROM = process.env.MAIL_FROM ?? 'Toshkent Freelance <no-reply@twstudio.uz>';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO ?? null;

const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_SECURE = (process.env.SMTP_SECURE ?? String(SMTP_PORT === 465)) === 'true';

const IS_BREVO_SMTP = SMTP_HOST.includes('brevo');

/**
 * Локальная разработка без провайдера: код печатается В КОНСОЛЬ СЕРВЕРА и
 * никуда больше. По умолчанию выключено — без почты регистрация честно
 * не работает, вместо того чтобы делать вид, что работает.
 */
const ALLOW_DEV_CODES = process.env.ALLOW_DEV_EMAIL_CODES === '1';

/** Отправка не должна висеть дольше этого — иначе запрос уходит в таймаут. */
const SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS ?? 20_000);

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const BREVO_READY = Boolean(BREVO_API_KEY);
const SMTP_READY = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const RESEND_READY = Boolean(resend);

/**
 * «Имя <адрес>» → { name, email }. Brevo принимает отправителя только
 * разобранным на части, а не одной строкой.
 */
function parseAddress(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    return name ? { name, email: match[2] } : { email: match[2] };
  }
  return { email: raw };
}

export const MAIL_FROM_ADDRESS = parseAddress(MAIL_FROM).email;

/* Порядок попыток. Первым идёт указанный в MAIL_PRIMARY, если он настроен. */
const MAIL_PRIMARY = (process.env.MAIL_PRIMARY ?? '').trim().toLowerCase();
const AVAILABLE = [
  BREVO_READY ? 'brevo' : null,
  SMTP_READY ? 'smtp' : null,
  RESEND_READY ? 'resend' : null,
].filter(Boolean);

export const TRANSPORT_ORDER =
  MAIL_PRIMARY && AVAILABLE.includes(MAIL_PRIMARY)
    ? [MAIL_PRIMARY, ...AVAILABLE.filter((id) => id !== MAIL_PRIMARY)]
    : AVAILABLE;

export const EMAIL_MODE = TRANSPORT_ORDER[0] ?? 'none';
export const MAIL_CONFIGURED = EMAIL_MODE !== 'none';

function describeTransport(id) {
  if (id === 'brevo') return `brevo api (отправитель ${MAIL_FROM_ADDRESS})`;
  if (id === 'smtp') return `smtp через ${SMTP_HOST}:${SMTP_PORT} (${SMTP_USER})`;
  if (id === 'resend') return 'resend';
  return id;
}

const [PRIMARY_LABEL, ...BACKUP_LABELS] = TRANSPORT_ORDER.map(describeTransport);

export const EMAIL_DESCRIPTION = MAIL_CONFIGURED
  ? PRIMARY_LABEL + (BACKUP_LABELS.length ? ` · запасные: ${BACKUP_LABELS.join(', ')}` : '')
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
/* Общее                                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Транспорт: Brevo HTTP API                                           */
/* ------------------------------------------------------------------ */

/**
 * Запрос к Brevo. Ошибку возвращаем не «400 Bad Request», а с телом ответа:
 * там лежит код (`invalid_parameter`, `unauthorized`, …), по которому и
 * пишется человеческое объяснение.
 */
async function brevoRequest(path, { method = 'GET', body, timeoutMs = 15_000 } = {}) {
  const response = await withTimeout(
    fetch(`${BREVO_API}${path}`, {
      method,
      headers: {
        'api-key': BREVO_API_KEY,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    timeoutMs,
    'запрос к Brevo'
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message ?? `Brevo ответил ${response.status}.`);
    error.provider = 'brevo';
    error.status = response.status;
    error.statusCode = response.status;
    error.brevoCode = payload?.code ?? null;
    throw error;
  }

  return payload ?? {};
}

/**
 * Человеческое объяснение отказов Brevo.
 *
 * Смысл тот же, что и у SMTP-версии: назвать конкретную кнопку, а не
 * пересказать код ошибки.
 */
function describeBrevoError(error) {
  const code = String(error?.brevoCode ?? '');
  const message = String(error?.message ?? '');
  const lower = message.toLowerCase();
  const status = Number(error?.status ?? 0);

  if (error?.code === 'mail_timeout') {
    return 'Brevo не ответил вовремя. Если это повторяется — проверьте, что у сервера есть выход в интернет по HTTPS.';
  }
  if (code === 'unauthorized' || status === 401 || status === 403) {
    if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
      return 'В BREVO_API_KEY лежит SMTP-ключ (xsmtpsib-…), а HTTP API нужен API-ключ (xkeysib-…). Возьмите его на https://app.brevo.com/settings/keys/api.';
    }
    return 'Brevo не принял ключ. Создайте API-ключ (xkeysib-…) на https://app.brevo.com/settings/keys/api и положите его в BREVO_API_KEY.';
  }
  if (code === 'account_under_validation' || lower.includes('under validation')) {
    return 'Аккаунт Brevo ещё на проверке — до её окончания транзакционные письма не уходят. Ответьте на письмо Brevo с описанием рассылки.';
  }
  if (code === 'not_enough_credits' || lower.includes('credit')) {
    return 'Кончился дневной лимит писем в Brevo (на бесплатном тарифе — 300 в сутки). Письма пойдут снова после обнуления лимита.';
  }
  if (
    lower.includes('sender') ||
    lower.includes('from address') ||
    lower.includes('not valid') ||
    lower.includes('not verified')
  ) {
    return `Отправитель ${MAIL_FROM_ADDRESS} не подтверждён в Brevo. Добавьте этот адрес на https://app.brevo.com/senders/list и подтвердите его письмом, затем повторите.`;
  }
  if (lower.includes('blocked') || lower.includes('blacklist') || lower.includes('unsubscribed')) {
    return 'Этот адрес в чёрном списке Brevo — снимите блокировку на https://app.brevo.com/contact/blocked.';
  }
  if (code === 'invalid_parameter') return `Brevo отклонил письмо: ${message}`;
  return message || 'Неизвестная ошибка Brevo.';
}

async function verifyBrevo() {
  if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
    return {
      ok: false,
      error:
        'В BREVO_API_KEY лежит SMTP-ключ (xsmtpsib-…). HTTP API работает с API-ключом (xkeysib-…) со страницы https://app.brevo.com/settings/keys/api.',
    };
  }

  try {
    await brevoRequest('/account');
  } catch (error) {
    return { ok: false, error: describeBrevoError(error) };
  }

  // Ключ верный — остаётся вторая половина: адрес отправителя. Brevo
  // подтверждает отдельные адреса, поэтому это проверяется списком, а не
  // доменом.
  try {
    const { senders = [] } = await brevoRequest('/senders');
    const wanted = MAIL_FROM_ADDRESS.toLowerCase();
    const found = senders.find((sender) => String(sender.email ?? '').toLowerCase() === wanted);
    const known = senders.map((sender) => sender.email).filter(Boolean);

    if (!found) {
      return {
        ok: false,
        error:
          `MAIL_FROM указывает на ${MAIL_FROM_ADDRESS}, но такого отправителя в Brevo нет. ` +
          (known.length
            ? `Подтверждённые сейчас: ${known.join(', ')}. Поставьте один из них в MAIL_FROM или добавьте нужный на https://app.brevo.com/senders/list.`
            : 'Добавьте адрес на https://app.brevo.com/senders/list и подтвердите его письмом.'),
      };
    }
    if (found.active === false) {
      return {
        ok: false,
        error: `Отправитель ${MAIL_FROM_ADDRESS} заведён в Brevo, но ещё не подтверждён. Откройте письмо от Brevo и нажмите ссылку подтверждения.`,
      };
    }
  } catch (error) {
    // Список отправителей — проверка приятная, но не обязательная: ключ
    // может быть выдан без этого доступа. Отправку это не запрещает.
    console.warn('[mail] не удалось прочитать список отправителей Brevo:', error.message);
  }

  return { ok: true, error: null };
}

/* ------------------------------------------------------------------ */
/* Транспорт: SMTP                                                     */
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

/**
 * Человеческое объяснение самых частых отказов SMTP.
 *
 * Смысл в том, чтобы назвать конкретную кнопку, которую надо нажать, а не
 * пересказать код ошибки. «535» ничего не говорит; «вы вставили API-ключ
 * вместо SMTP-ключа» — говорит всё.
 */
function describeSmtpError(error) {
  const message = String(error?.message ?? error ?? '');
  const lower = message.toLowerCase();
  const code = String(error?.code ?? '');

  if (code === 'EAUTH' || lower.includes('535') || lower.includes('authentication')) {
    // Самая частая причина: у Brevo две разные страницы ключей, и API-ключ
    // (xkeysib-…) внешне похож на SMTP-ключ (xsmtpsib-…), но релеем не
    // принимается.
    if (IS_BREVO_SMTP && SMTP_PASS.startsWith('xkeysib-')) {
      return 'В SMTP_PASS вставлен API-ключ Brevo (xkeysib-…), а релею нужен SMTP-ключ (xsmtpsib-…). Возьмите его на https://app.brevo.com/settings/keys/smtp — кнопка «Generate a new SMTP key».';
    }
    if (IS_BREVO_SMTP) {
      return `Brevo отклонил пару логин/пароль (${SMTP_USER}). Проверьте, что SMTP_PASS — это SMTP-ключ со страницы https://app.brevo.com/settings/keys/smtp (обычно начинается с xsmtpsib-), а не пароль от аккаунта и не API-ключ.`;
    }
    return `Почтовый сервер отклонил логин или пароль (${SMTP_USER}). Для Gmail нужен пароль приложения, а не пароль от аккаунта.`;
  }
  if (
    IS_BREVO_SMTP &&
    (lower.includes('not activated') || lower.includes('account is not') || lower.includes('unrecognized'))
  ) {
    return 'Brevo не активировал аккаунт для транзакционных писем. Откройте https://app.brevo.com/senders/list — там будет либо кнопка активации, либо письмо с просьбой описать, для чего нужна рассылка.';
  }
  if (lower.includes('sender') || lower.includes('from address') || lower.includes('not verified')) {
    return `Адрес отправителя ${MAIL_FROM_ADDRESS} не подтверждён у провайдера. Добавьте и подтвердите его на https://app.brevo.com/senders/list, затем повторите.`;
  }
  if (code === 'ETIMEDOUT' || code === 'mail_timeout' || lower.includes('timed out') || lower.includes('timeout')) {
    return (
      `Не удалось достучаться до ${SMTP_HOST}:${SMTP_PORT} — порт закрыт или хостинг его блокирует. ` +
      'Render и большинство бесплатных площадок режут исходящие SMTP-порты; там надёжнее HTTP API: задайте BREVO_API_KEY.'
    );
  }
  if (code === 'ECONNREFUSED') return `${SMTP_HOST}:${SMTP_PORT} отказал в соединении.`;
  if (code === 'ENOTFOUND' || code === 'EDNS') return `Хост ${SMTP_HOST} не найден — проверьте SMTP_HOST.`;
  return message || 'Неизвестная ошибка SMTP.';
}

/* ------------------------------------------------------------------ */
/* Транспорт: Resend                                                   */
/* ------------------------------------------------------------------ */

/**
 * Ошибки, после которых бессмысленно повторять попытку для этого адреса:
 * провайдер в тестовом режиме, домен не подтверждён, адрес в подавленных.
 * Их отличает то, что виноват не адрес человека, а настройка отправителя.
 */
function describeDeliveryBlock(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  const status = Number(error?.statusCode ?? error?.status ?? 0);

  if (message.includes('only send testing emails') || message.includes('testing email')) {
    return 'Resend работает в тестовом режиме и принимает письма только на адрес владельца ключа. Для отправки всем нужен подтверждённый домен — либо переключитесь на Brevo (BREVO_API_KEY), он подтверждает отдельный адрес.';
  }
  if (message.includes('domain is not verified') || message.includes('verify a domain')) {
    return 'Домен отправителя не подтверждён в Resend, поэтому письмо не ушло. Resend умеет подтверждать только домен целиком; чтобы отправлять с адреса на gmail.com, используйте Brevo (BREVO_API_KEY).';
  }
  if (message.includes('suppress')) {
    return 'Этот адрес в списке подавленных у почтового провайдера.';
  }
  if (status === 401 || status === 403 || message.includes('api key')) {
    return 'Почтовый провайдер отклонил ключ доступа, письмо не отправлено.';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Проверка настроек                                                   */
/* ------------------------------------------------------------------ */

/** Заметная ошибка в настройке, которую видно ещё до попытки соединения. */
export function inspectMailConfig() {
  if (BREVO_READY && BREVO_API_KEY.startsWith('xsmtpsib-')) {
    return 'BREVO_API_KEY похож на SMTP-ключ (xsmtpsib-…). HTTP API работает с API-ключом (xkeysib-…) со страницы https://app.brevo.com/settings/keys/api';
  }
  if (EMAIL_MODE !== 'smtp') return null;
  if (IS_BREVO_SMTP && SMTP_PASS.startsWith('xkeysib-')) {
    return 'SMTP_PASS похож на API-ключ Brevo (xkeysib-…). Релею нужен SMTP-ключ (xsmtpsib-…) со страницы https://app.brevo.com/settings/keys/smtp';
  }
  if (SMTP_HOST.includes('gmail') && /\s/.test(SMTP_PASS.trim()) === false && SMTP_PASS.length !== 16) {
    return 'Для Gmail в SMTP_PASS нужен 16-символьный пароль приложения с https://myaccount.google.com/apppasswords';
  }
  return null;
}

/**
 * Проверка транспорта при старте сервера.
 *
 * Смысл — узнать про неверный ключ сразу, а не в момент, когда первый
 * человек нажмёт «Зарегистрироваться».
 */
export async function verifyMailTransport() {
  if (EMAIL_MODE === 'none') {
    return {
      ok: false,
      mode: 'none',
      error: ALLOW_DEV_CODES
        ? 'Провайдер не настроен. ALLOW_DEV_EMAIL_CODES=1 — код печатается в консоль сервера.'
        : 'Провайдер не настроен: задайте BREVO_API_KEY (проще всего), либо SMTP_HOST + SMTP_USER + SMTP_PASS, либо RESEND_API_KEY.',
    };
  }

  const misconfigured = inspectMailConfig();
  if (misconfigured) return { ok: false, mode: EMAIL_MODE, error: misconfigured };

  if (EMAIL_MODE === 'brevo') {
    const result = await verifyBrevo();
    return { ...result, mode: 'brevo' };
  }

  if (EMAIL_MODE === 'smtp') {
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

/* ------------------------------------------------------------------ */
/* Письмо                                                              */
/* ------------------------------------------------------------------ */

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

/** Кто именно отказал — тот и объясняет причину. */
function describeProblem(error) {
  if (error?.provider === 'brevo') return describeBrevoError(error);
  if (error?.provider === 'resend') return describeDeliveryBlock(error) ?? String(error.message ?? error);
  return describeDeliveryBlock(error) ?? describeSmtpError(error);
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

  const senders = {
    async brevo() {
      const result = await brevoRequest('/smtp/email', {
        method: 'POST',
        timeoutMs: SEND_TIMEOUT_MS,
        body: {
          sender: parseAddress(MAIL_FROM),
          to: [{ email: to, ...(name ? { name } : {}) }],
          subject,
          htmlContent: html,
          textContent: text,
          ...(MAIL_REPLY_TO ? { replyTo: parseAddress(MAIL_REPLY_TO) } : {}),
        },
      });
      console.info(`[mail] код отправлен на ${to} через brevo api (id ${result.messageId ?? '—'})`);
      return {};
    },

    async smtp() {
      const transport = await getSmtpTransport();
      await withTimeout(
        transport.sendMail({
          from: MAIL_FROM,
          to,
          subject,
          html,
          text,
          ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
        }),
        SEND_TIMEOUT_MS,
        'отправка письма'
      );
      console.info(`[mail] код отправлен на ${to} через ${SMTP_HOST}`);
      return {};
    },

    async resend() {
      const { error } = await withTimeout(
        resend.emails.send({
          from: MAIL_FROM,
          to: [to],
          subject,
          html,
          text,
          ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
        }),
        SEND_TIMEOUT_MS,
        'отправка письма'
      );
      if (error) {
        throw Object.assign(new Error(error.message ?? 'Email delivery failed'), {
          provider: 'resend',
          statusCode: error.statusCode ?? error.name,
        });
      }
      console.info(`[mail] код отправлен на ${to} через resend`);
      return {};
    },
  };

  /* Объясняем отказ по ПЕРВОМУ транспорту, а не по последнему: первый —
     это тот, который администратор настраивал специально, и именно его
     ошибку имеет смысл чинить. Остальные попытки видно в логе. */
  let firstProblem = null;

  for (const id of TRANSPORT_ORDER) {
    try {
      return await senders[id]();
    } catch (error) {
      firstProblem ??= error;
      console.error(`[mail] ${id} не доставил письмо на ${to}:`, error?.message ?? error);
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
  const reason = firstProblem
    ? describeProblem(firstProblem)
    : 'Почтовый провайдер не настроен: задайте BREVO_API_KEY, либо SMTP_HOST + SMTP_USER + SMTP_PASS, либо RESEND_API_KEY.';

  console.error(`[mail] код для ${to} НЕ доставлен: ${reason}`);

  const error = new Error(
    MAIL_CONFIGURED
      ? 'Почтовый сервер не принял письмо с кодом, поэтому регистрация не завершена. Обычно дело в настройках отправки, а не в вашем адресе — сообщите администратору площадки.'
      : 'Отправка писем на сервере не настроена, поэтому код выслать некуда. Сообщите администратору площадки.'
  );
  error.status = MAIL_CONFIGURED ? 502 : 503;
  error.code = 'email_delivery_failed';
  error.expose = true;
  error.reason = reason;
  throw error;
}
