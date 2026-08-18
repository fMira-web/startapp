import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useQuoteStore, useMeta } from '../../store/useQuoteStore';
import { formatDelta } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';

function Indicator({ active, reduce }) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-200 ${
        active ? 'border-brand bg-brand' : 'border-line-strong bg-surface'
      }`}
    >
      <motion.span
        initial={false}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 26 }}
        className="flex items-center justify-center text-white"
      >
        <Check size={ICON.xs} strokeWidth={STROKE.emphasis} />
      </motion.span>
    </span>
  );
}

export default function FeatureToggleCard({ item }) {
  const meta = useMeta();
  const active = useQuoteStore((state) => Boolean(state.selections.toggles[item.id]));
  const toggleItem = useQuoteStore((state) => state.toggleItem);
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={() => toggleItem(item.id)}
      whileTap={reduce ? undefined : { scale: 0.994 }}
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      className={`group relative w-full cursor-pointer rounded-card border bg-surface p-5 text-left transition-[border-color,box-shadow,background-color] duration-200 sm:p-6 ${
        active
          ? 'border-brand/45 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(30,58,95,0.4)]'
          : 'border-line hover:border-line-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-[0.875rem] bg-brand transition-opacity duration-200 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <span className="flex items-start gap-4">
        <Indicator active={active} reduce={reduce} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="text-base font-semibold tracking-[-0.01em] text-ink">{item.name}</span>
            {item.recommended && (
              <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand">
                Рекомендуем
              </span>
            )}
          </span>

          <span className="mt-2 block text-[0.9375rem] leading-relaxed text-ink-muted">
            {item.description}
          </span>

          {item.note && (
            <span className="mt-3 block text-sm font-medium text-signal">{item.note}</span>
          )}
        </span>

        <span className="tnum shrink-0 pl-2 text-right">
          <span
            className={`block text-base font-semibold tracking-[-0.01em] transition-colors duration-200 ${
              active ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            {formatDelta(item.price, meta)}
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            {active ? 'Выбрано' : 'Добавить'}
          </span>
        </span>
      </span>
    </motion.button>
  );
}
