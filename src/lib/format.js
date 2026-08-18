/**
 * Денежное форматирование для узбекского рынка.
 *
 * Базовая валюта проекта — сум (UZS). Доллар показывается как справочный
 * эквивалент по официальному курсу ЦБ РУз, потому что клиенты в Узбекистане
 * держат в голове обе цифры.
 */

export const FX = {
  /** Официальный курс ЦБ РУз на 18.08.2026 */
  uzsPerUsd: 11857.35,
  date: '2026-08-18',
  source: 'ЦБ РУз',
};

const NBSP = ' ';

function groups(value) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function uzsToUsd(uzs) {
  return uzs / FX.uzsPerUsd;
}

export function usdToUzs(usd) {
  return usd * FX.uzsPerUsd;
}

/**
 * `meta.currency` — валюта, в которой хранится сумма (всегда UZS в шаблоне).
 * `meta.view`     — валюта, в которой её сейчас хотят видеть ('UZS' | 'USD').
 *
 * 24950000 -> "24 950 000 сум"  либо  "$2 104"
 */
export function formatCurrency(amount, meta = {}) {
  const stored = meta.currency ?? 'UZS';
  const view = meta.view ?? stored;

  if (view === 'USD') {
    const usd = stored === 'UZS' ? uzsToUsd(amount) : amount;
    return `$${groups(usd)}`;
  }

  const uzs = stored === 'USD' ? usdToUzs(amount) : amount;
  return `${groups(uzs)}${NBSP}сум`;
}

/** Короткая форма для крупных сумм: 24950000 -> "24,95 млн сум" */
export function formatCompact(amount, meta = {}) {
  const view = meta.view ?? meta.currency ?? 'UZS';
  if (view === 'USD') return formatCurrency(amount, meta);
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    const text = millions >= 100 ? Math.round(millions) : millions.toFixed(2).replace('.', ',');
    return `${text}${NBSP}млн${NBSP}сум`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${groups(amount / 1000)}${NBSP}тыс${NBSP}сум`;
  }
  return formatCurrency(amount, meta);
}

/** Всегда показывает вторую валюту — для подписи под крупной цифрой. */
export function formatAlternate(amount, meta = {}) {
  const view = meta.view ?? meta.currency ?? 'UZS';
  return formatCurrency(amount, { ...meta, view: view === 'USD' ? 'UZS' : 'USD' });
}

/** Для строк скидок: -1000000 -> "−1 000 000 сум" */
export function formatSignedCurrency(amount, meta) {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(amount), meta)}`;
}

/** 1500000 -> "+1 500 000 сум", 0 -> "Включено" */
export function formatDelta(amount, meta) {
  if (amount === 0) return 'Включено';
  const sign = amount > 0 ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(amount), meta)}`;
}

/**
 * Русские числительные: pluralize(5, ['страница', 'страницы', 'страниц'])
 */
export function pluralize(count, forms) {
  if (!Array.isArray(forms) || forms.length < 3) return forms?.[0] ?? '';
  const abs = Math.abs(count) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

export function formatDate(iso, locale = 'ru-RU') {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(iso, locale = 'ru-RU') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function maskIdentifier(value, method) {
  if (!value) return '';
  if (method === 'email') {
    const [name, domain] = value.split('@');
    if (!domain) return value;
    const head = name.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  const tail = digits.slice(-3);
  return `${value.slice(0, value.length - 3).replace(/\d/g, '•')}${tail}`;
}
