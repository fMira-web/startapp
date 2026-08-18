import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useQuoteStore, useMeta } from '../../store/useQuoteStore';
import { formatCurrency } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';

export default function TierSelector({ section }) {
  const meta = useMeta();
  const selectedId = useQuoteStore((state) => state.selections.tiers[section.id]);
  const selectTier = useQuoteStore((state) => state.selectTier);
  const reduce = useReducedMotion();
  const groupName = useId();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {section.options.map((option) => {
        const active = option.id === selectedId;
        return (
          <label
            key={option.id}
            className={`group relative flex cursor-pointer flex-col rounded-card border bg-surface p-5 transition-[border-color,box-shadow] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ring sm:p-6 ${
              active ? 'border-brand/45' : 'border-line hover:border-line-strong'
            }`}
          >
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={active}
              onChange={() => selectTier(section.id, option.id)}
              className="sr-only"
            />

            {active && !reduce && (
              <motion.span
                layoutId={`tier-halo-${section.id}`}
                aria-hidden="true"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="pointer-events-none absolute inset-0 rounded-card bg-brand-tint/70"
              />
            )}
            {active && reduce && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-card bg-brand-tint/70"
              />
            )}

            <span className="relative flex flex-1 flex-col">
              <span className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold tracking-[-0.01em] text-ink">
                  {option.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                    active ? 'border-brand bg-brand' : 'border-line-strong bg-surface'
                  }`}
                >
                  <motion.span
                    initial={false}
                    animate={active ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
                    transition={
                      reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 26 }
                    }
                    className="flex text-white"
                  >
                    <Check size={ICON.xs} strokeWidth={STROKE.emphasis} />
                  </motion.span>
                </span>
              </span>

              {option.badge && (
                <span className="mt-2 inline-flex w-fit rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white">
                  {option.badge}
                </span>
              )}

              <span className="mt-2 block text-sm leading-relaxed text-ink-muted">
                {option.summary}
              </span>

              <span className="tnum mt-5 block text-2xl font-semibold tracking-[-0.02em] text-ink">
                {option.price > 0 ? formatCurrency(option.price, meta) : (option.priceLabel ?? 'Включено')}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {option.price > 0 ? (option.priceNote ?? 'за 12 месяцев') : 'вместе с базовым пакетом'}
              </span>

              <span className="mt-5 block border-t border-line pt-4">
                <span className="flex flex-col gap-2">
                  {option.features.map((feature) => (
                    <span key={feature} className="flex items-start gap-2.5">
                      <Check
                        size={ICON.xs}
                        strokeWidth={STROKE.regular}
                        aria-hidden="true"
                        className={`mt-[0.28rem] shrink-0 ${active ? 'text-brand' : 'text-ink-muted'}`}
                      />
                      <span className="text-sm leading-relaxed text-ink-soft">{feature}</span>
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
