const currencyCache = new Map();

function formatter(locale, currency, options) {
  const key = `${locale}|${currency}|${JSON.stringify(options)}`;
  if (!currencyCache.has(key)) {
    currencyCache.set(
      key,
      new Intl.NumberFormat(locale, { style: 'currency', currency, ...options })
    );
  }
  return currencyCache.get(key);
}

/** 48000 -> "$48,000" */
export function formatCurrency(amount, { locale = 'en-US', currency = 'USD' } = {}) {
  return formatter(locale, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** Signed variant used for discount rows: -3500 -> "−$3,500" */
export function formatSignedCurrency(amount, options) {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(amount), options)}`;
}

/** 9500 -> "+$9,500" */
export function formatDelta(amount, options) {
  if (amount === 0) return 'Included';
  const sign = amount > 0 ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(amount), options)}`;
}

export function formatDate(iso, locale = 'en-US') {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(iso, locale = 'en-US') {
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
