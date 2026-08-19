import { forwardRef } from 'react';
import { Loader2, Star } from 'lucide-react';
import { toHref } from '../../lib/router';

/**
 * Общие детали интерфейса биржи.
 *
 * Все экраны собираются из этого набора, поэтому карточка проекта на доске
 * и та же карточка в админке выглядят одинаково, а статус «В работе» везде
 * один и тот же цвет. Токены берутся из global.css — новых цветов здесь нет.
 */

const NBSP = ' ';

/* ------------------------------------------------------------------ */
/* Форматирование                                                      */
/* ------------------------------------------------------------------ */

export function groupDigits(value) {
  return Math.round(Number(value) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function money(amount, currency = 'UZS') {
  const label = currency === 'UZS' ? 'сум' : currency;
  return `${groupDigits(amount)}${NBSP}${label}`;
}

/** Крупные суммы читаются лучше в миллионах: 45 000 000 → 45 млн сум. */
export function moneyShort(amount, currency = 'UZS') {
  const value = Number(amount) || 0;
  if (currency !== 'UZS' || Math.abs(value) < 1_000_000) return money(value, currency);
  const millions = value / 1_000_000;
  const text = millions >= 100 ? Math.round(millions) : String(Math.round(millions * 10) / 10).replace('.', ',');
  return `${text}${NBSP}млн${NBSP}сум`;
}

export function plural(count, forms) {
  const abs = Math.abs(count) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

export function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}${NBSP}${plural(minutes, ['минуту', 'минуты', 'минут'])} назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}${NBSP}${plural(hours, ['час', 'часа', 'часов'])} назад`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}${NBSP}${plural(days, ['день', 'дня', 'дней'])} назад`;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(then);
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/* ------------------------------------------------------------------ */
/* Навигация                                                           */
/* ------------------------------------------------------------------ */

export function AppLink({ to, className = '', children, ...rest }) {
  return (
    <a href={toHref(to)} className={className} {...rest}>
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Индикаторы состояния                                                */
/* ------------------------------------------------------------------ */

const STATUS_STYLE = {
  open: { label: 'В поиске', className: 'bg-brand-tint text-brand ring-brand/20' },
  in_progress: { label: 'В работе', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  completed: { label: 'Завершён', className: 'bg-signal-tint text-signal ring-signal/20' },
  cancelled: { label: 'Отменён', className: 'bg-surface-sunken text-ink-muted ring-line-strong' },
};

export function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.cancelled;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}

export function ModerationBadge({ moderation }) {
  if (!moderation || moderation === 'published') return null;
  const label = moderation === 'hidden' ? 'Скрыт модератором' : 'На доработке';
  return (
    <span className="inline-flex items-center rounded-full bg-danger-tint px-2.5 py-1 text-xs font-semibold text-danger ring-1 ring-danger/20">
      {label}
    </span>
  );
}

export function RoleBadge({ role, isAdmin }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
        Администратор
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink-soft">
      {role === 'developer' ? 'Программист' : 'Заказчик'}
    </span>
  );
}

export function Rating({ value = 0, count = 0, size = 14 }) {
  const rounded = Math.round(Number(value) * 10) / 10;
  if (!count) return <span className="text-xs text-ink-muted">Пока без оценок</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
      <Star size={size} strokeWidth={1.8} className="fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="tnum font-semibold text-ink">{String(rounded).replace('.', ',')}</span>
      <span className="text-ink-muted">
        · {count} {plural(count, ['отзыв', 'отзыва', 'отзывов'])}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Аватар                                                              */
/* ------------------------------------------------------------------ */

const AVATAR_TONES = [
  'bg-brand text-white',
  'bg-signal text-white',
  'bg-amber-500 text-white',
  'bg-slate-600 text-white',
  'bg-rose-500 text-white',
];

/** Только звёзды, без подписи — для строки отдельного отзыва. */
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} из 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          size={size}
          strokeWidth={1.6}
          aria-hidden="true"
          className={step <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-line-strong'}
        />
      ))}
    </span>
  );
}

export function Avatar({ user, size = 40 }) {
  const name = user?.fullName || user?.email || '?';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const seed = [...String(user?.id ?? name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tone = AVATAR_TONES[seed % AVATAR_TONES.length];

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tone}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initials || '?'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Кнопки, поля, карточки                                              */
/* ------------------------------------------------------------------ */

const BUTTON_TONES = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50',
  secondary: 'border border-line-strong bg-surface text-ink-soft hover:border-brand/40 hover:text-ink',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'border border-danger/30 bg-danger-tint text-danger hover:bg-danger hover:text-white',
  signal: 'bg-signal text-white hover:brightness-110',
};

export function Button({
  tone = 'primary',
  size = 'md',
  pending = false,
  className = '',
  children,
  ...rest
}) {
  const sizing = size === 'sm' ? 'min-h-9 px-3 text-[0.8125rem]' : 'min-h-11 px-4 text-sm';
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || pending}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${BUTTON_TONES[tone]} ${className}`}
    >
      {pending && <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-card border border-line bg-surface ${className}`} {...rest}>
      {children}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, hint, error, id, className = '', ...rest }, ref) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-ink-soft">{label}</span>}
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        className={`min-h-11 w-full rounded-control border bg-surface px-3.5 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 ${
          error ? 'border-danger' : 'border-line-strong focus:border-brand'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
});

export function TextArea({ label, hint, error, id, rows = 5, className = '', ...rest }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-ink-soft">{label}</span>}
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full rounded-control border bg-surface px-3.5 py-2.5 text-[0.9375rem] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 ${
          error ? 'border-danger' : 'border-line-strong focus:border-brand'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Select({ label, hint, id, options = [], placeholder, className = '', ...rest }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-ink-soft">{label}</span>}
      <select
        id={id}
        className={`min-h-11 w-full cursor-pointer rounded-control border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink outline-none transition-colors duration-150 focus:border-brand ${className}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.id ?? option.value} value={option.id ?? option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Chip({ active = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-surface text-ink-soft hover:border-brand/40 hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TagPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink-soft">
      #{children}
    </span>
  );
}

const ALERT_TONES = {
  error: 'border-danger/30 bg-danger-tint text-danger',
  info: 'border-line bg-surface-sunken text-ink-soft',
  success: 'border-signal/25 bg-signal-tint text-signal',
};

export function Alert({ tone = 'info', children, className = '' }) {
  if (!children) return null;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-control border px-4 py-3 text-[0.8125rem] leading-relaxed ${ALERT_TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = 'Загружаю' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-muted">
      <Loader2 size={18} strokeWidth={2} className="animate-spin" aria-hidden="true" />
      <span role="status">{label}…</span>
    </div>
  );
}

export function Empty({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
          <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
        </span>
      )}
      <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
      {hint && <p className="measure text-sm leading-relaxed text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, action, id }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h2 id={id} className="mt-2 text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]">
          {title}
        </h2>
        {description && <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
