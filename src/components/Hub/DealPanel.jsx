import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Hammer,
  Loader2,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useMeta } from '../../store/useQuoteStore';
import { useHubStore } from '../../store/useHubStore';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { DEAL_STATUS, PLATFORM_FEE_RATE } from '../../data/hubData';
import { ICON, STROKE } from '../../lib/icons';

const STEPS = [
  { id: 'escrow', label: 'Деньги зарезервированы', icon: ShieldCheck },
  { id: 'in_progress', label: 'Исполнитель работает', icon: Hammer },
  { id: 'submitted', label: 'Работа отправлена', icon: Send },
  { id: 'released', label: 'Оплата переведена', icon: Wallet },
];

function stepIndex(status) {
  const index = STEPS.findIndex((step) => step.id === status);
  return index === -1 ? 0 : index;
}

function Money({ label, value, meta, tone = 'ink' }) {
  const toneClass =
    tone === 'signal' ? 'text-signal' : tone === 'muted' ? 'text-ink-muted' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[0.8125rem] text-ink-muted">{label}</span>
      <span className={`tnum text-[0.8125rem] font-medium ${toneClass}`}>
        {formatCurrency(value, meta)}
      </span>
    </div>
  );
}

function DeliveryForm({ onSubmit, pending }) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ url: url.trim(), note: note.trim() });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="label-caps">Ссылка на работу</span>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/... или ссылка на демо"
          className="min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/70"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label-caps">Что сделано</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Каталог, корзина и оплата Payme готовы, тестовые платежи проходят."
          className="rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
      >
        {pending ? (
          <Loader2 size={ICON.sm} strokeWidth={STROKE.regular} className="animate-spin" />
        ) : (
          <Send size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
        )}
        Отправить работу заказчику
      </button>
    </form>
  );
}

export default function DealPanel({ deal, viewer }) {
  const meta = useMeta();
  const reduce = useReducedMotion();
  const pendingAction = useHubStore((state) => state.pendingAction);
  const error = useHubStore((state) => state.error);
  const startWork = useHubStore((state) => state.startWork);
  const submitWork = useHubStore((state) => state.submitWork);
  const releasePayment = useHubStore((state) => state.releasePayment);

  if (!deal) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface px-5 py-6">
        <p className="text-sm font-medium text-ink">Исполнитель ещё не выбран</p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
          Примите один из откликов — сумма уйдёт в резерв и станет доступна исполнителю только
          после того, как вы примете работу.
        </p>
      </div>
    );
  }

  const status = DEAL_STATUS[deal.status] ?? DEAL_STATUS.escrow;
  const current = stepIndex(deal.status);
  const isClient = viewer === 'client';

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="label-caps">Сделка</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${
            deal.status === 'released'
              ? 'bg-signal-tint text-signal'
              : 'bg-brand-tint text-brand'
          }`}
        >
          {status.label}
        </span>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand"
          >
            {(deal.developer?.full_name ?? '?')
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">
              {deal.developer?.full_name ?? 'Исполнитель'}
            </p>
            <p className="truncate text-xs text-ink-muted">{deal.developer?.headline}</p>
          </div>
        </div>

        <ol className="mt-5 flex flex-col gap-0">
          {STEPS.map((step, index) => {
            const done = index < current;
            const active = index === current;
            const Icon = step.icon;
            return (
              <li key={step.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-200 ${
                      done || active
                        ? 'border-transparent bg-brand text-white'
                        : 'border-line-strong bg-surface text-ink-muted'
                    }`}
                  >
                    <Icon size={ICON.xs} strokeWidth={STROKE.regular} />
                  </span>
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`h-6 w-px ${done ? 'bg-brand' : 'bg-line'}`}
                    />
                  )}
                </div>
                <p
                  className={`pt-1 text-[0.8125rem] leading-tight ${
                    active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-muted'
                  }`}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 border-t border-line pt-3">
          <Money label="Сумма сделки" value={deal.amount} meta={meta} />
          <Money
            label={`Комиссия площадки (${Math.round(PLATFORM_FEE_RATE * 100)}%)`}
            value={deal.platform_fee}
            meta={meta}
            tone="muted"
          />
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <span className="text-sm font-medium text-ink-soft">
              {deal.status === 'released' ? 'Выплачено исполнителю' : 'К выплате исполнителю'}
            </span>
            <span
              className={`tnum text-lg font-semibold tracking-[-0.02em] ${
                deal.status === 'released' ? 'text-signal' : 'text-ink'
              }`}
            >
              {formatCurrency(deal.payout, meta)}
            </span>
          </div>
        </div>

        {deal.delivery_url && (
          <div className="mt-4 rounded-control bg-surface-sunken px-4 py-3">
            <p className="label-caps">Сдано</p>
            <a
              href={deal.delivery_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-sm font-medium text-brand underline underline-offset-2"
            >
              {deal.delivery_url}
            </a>
            {deal.delivery_note && (
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                {deal.delivery_note}
              </p>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-tint px-3 py-2"
              >
                <AlertCircle
                  size={ICON.xs}
                  strokeWidth={STROKE.regular}
                  aria-hidden="true"
                  className="mt-[0.2rem] shrink-0 text-danger"
                />
                <p className="text-xs leading-relaxed text-danger">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Действия зависят от роли смотрящего и текущего статуса */}
        {!isClient && deal.status === 'escrow' && (
          <button
            type="button"
            onClick={startWork}
            disabled={pendingAction === 'start'}
            className="mt-5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
          >
            {pendingAction === 'start' && (
              <Loader2 size={ICON.sm} strokeWidth={STROKE.regular} className="animate-spin" />
            )}
            Начать работу
          </button>
        )}

        {!isClient && deal.status === 'in_progress' && (
          <DeliveryForm onSubmit={submitWork} pending={pendingAction === 'submit'} />
        )}

        {!isClient && deal.status === 'submitted' && (
          <p className="mt-5 rounded-control bg-brand-tint px-4 py-3 text-[0.8125rem] leading-relaxed text-brand">
            Работа у заказчика на проверке. Как только он её примет, {formatCurrency(deal.payout, meta)}{' '}
            уйдут на вашу карту.
          </p>
        )}

        {isClient && deal.status === 'submitted' && (
          <button
            type="button"
            onClick={releasePayment}
            disabled={pendingAction === 'release'}
            className="mt-5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-signal px-5 text-sm font-semibold text-white transition-colors duration-200 hover:brightness-95 disabled:opacity-45"
          >
            {pendingAction === 'release' ? (
              <Loader2 size={ICON.sm} strokeWidth={STROKE.regular} className="animate-spin" />
            ) : (
              <BadgeCheck size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
            )}
            Принять работу и выплатить
          </button>
        )}

        {isClient && ['escrow', 'in_progress'].includes(deal.status) && (
          <p className="mt-5 flex items-start gap-2 rounded-control bg-surface-sunken px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            <ShieldCheck
              size={ICON.sm}
              strokeWidth={STROKE.regular}
              aria-hidden="true"
              className="mt-[0.15rem] shrink-0 text-brand"
            />
            Деньги удерживаются площадкой. Исполнитель получит их только после вашей приёмки.
          </p>
        )}

        {deal.status === 'released' && (
          <p className="mt-5 flex items-start gap-2 rounded-control bg-signal-tint px-4 py-3 text-[0.8125rem] leading-relaxed text-signal">
            <CheckCircle2
              size={ICON.sm}
              strokeWidth={STROKE.regular}
              aria-hidden="true"
              className="mt-[0.15rem] shrink-0"
            />
            Сделка закрыта {deal.released_at ? formatDateTime(deal.released_at, meta.locale) : ''}.
          </p>
        )}
      </div>
    </div>
  );
}
