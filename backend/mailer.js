import { Resend } from 'resend';

/**
 * Email delivery, deliberately vendor-independent.
 *
 * At boot one transport is resolved from whatever is configured:
 *   'resend' — RESEND_API_KEY
 *   'smtp'   — SMTP_HOST + SMTP_USER + SMTP_PASS (any mailbox: a Gmail
 *              account with an app password, Yandex, a corporate relay)
 *   'dev'    — nothing configured; the code is printed to the console and
 *              handed back to the UI so the flow works out of the box
 *
 * SMTP_USER is the mailbox the server sends *through*. The recipient is always
 * the address the person typed into the form.
 */

const IS_PRODUCTION = (process.env.NODE_ENV ?? 'development') === 'production';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
export const MAIL_FROM = process.env.MAIL_FROM ?? 'Toshkent Web Studio <no-reply@twstudio.uz>';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO ?? null;

const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_SECURE = (process.env.SMTP_SECURE ?? String(SMTP_PORT === 465)) === 'true';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const SMTP_READY = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

export const EMAIL_MODE = resend ? 'resend' : SMTP_READY ? 'smtp' : 'dev';
export const EMAIL_DESCRIPTION =
  EMAIL_MODE === 'smtp' ? `smtp via ${SMTP_HOST}:${SMTP_PORT}` : EMAIL_MODE;

let smtpTransport = null;
async function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const { default: nodemailer } = await import('nodemailer');
  smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return smtpTransport;
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
 * @param {{ to: string, code: string, name?: string, intro?: string }} input
 * @returns {Promise<{ devCode?: string }>}
 */
export async function sendCodeEmail({ to, code, name, intro }) {
  const subject = `${code} — ваш код подтверждения`;
  const body =
    intro ?? 'Введите код ниже, чтобы подтвердить почту и завершить вход.';
  const html = codeEmailHtml({ code, name, intro: body });
  const text = `${body}\n\nВаш код: ${code}. Он действует 10 минут.`;

  if (EMAIL_MODE === 'resend') {
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
    });
    if (error) throw new Error(error.message ?? 'Email delivery failed');
    return {};
  }

  if (EMAIL_MODE === 'smtp') {
    const transport = await getSmtpTransport();
    await transport.sendMail({
      from: MAIL_FROM,
      to, // ← the address the person registered with, never SMTP_USER
      subject,
      html,
      text,
      ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
    });
    return {};
  }

  if (IS_PRODUCTION) {
    throw new Error(
      'No email provider configured. Set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.'
    );
  }

  console.info(
    `\n  ┌─ verification email ────────────────────\n  │  to:   ${to}\n  │  code: ${code}\n  └─────────────────────────────────────────\n`
  );
  return { devCode: code };
}
