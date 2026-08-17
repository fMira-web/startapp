import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useQuoteStore, useTemplate } from '../../store/useQuoteStore';
import { formatCurrency } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';

export default function QuantitySelector({ item }) {
  const meta = useTemplate().meta;
  const quantity = useQuoteStore((state) => state.selections.quantities[item.id] ?? 0);
  const setQuantity = useQuoteStore((state) => state.setQuantity);
  const stepQuantity = useQuoteStore((state) => state.stepQuantity);
  const reduce = useReducedMotion();

  const inputId = useId();
  const descriptionId = `${inputId}-description`;

  const min = item.min ?? 0;
  const max = item.max ?? 10;
  const step = item.step ?? 1;
  const lineTotal = quantity * item.unitPrice;
  const unit = quantity === 1 ? item.unitLabel : (item.unitLabelPlural ?? `${item.unitLabel}s`);
  const fill = max === min ? 0 : ((quantity - min) / (max - min)) * 100;

  return (
    <div
      className={`rounded-card border bg-surface p-5 transition-colors duration-200 sm:p-6 ${
        quantity > 0 ? 'border-brand/35' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="text-base font-semibold tracking-[-0.01em] text-ink">
            {item.name}
          </label>
          <p id={descriptionId} className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
            {item.description}
          </p>
        </div>

        <div className="tnum text-right">
          <motion.p
            key={lineTotal}
            initial={reduce ? false : { opacity: 0.35, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="text-base font-semibold tracking-[-0.01em] text-ink"
          >
            {lineTotal > 0 ? formatCurrency(lineTotal, meta) : 'Not included'}
          </motion.p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatCurrency(item.unitPrice, meta)} per {item.unitLabel}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-1 rounded-control border border-line bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => stepQuantity(item.id, -1)}
            disabled={quantity <= min}
            aria-label={`Decrease ${item.name}`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[8px] text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <Minus size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
          </button>

          <output
            htmlFor={inputId}
            className="tnum w-12 text-center text-base font-semibold text-ink"
          >
            {quantity}
          </output>

          <button
            type="button"
            onClick={() => stepQuantity(item.id, 1)}
            disabled={quantity >= max}
            aria-label={`Increase ${item.name}`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[8px] text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <Plus size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <input
            id={inputId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={quantity}
            aria-describedby={descriptionId}
            aria-valuetext={`${quantity} ${unit}`}
            onChange={(event) => setQuantity(item.id, event.target.value)}
            style={{ '--range-fill': `${fill}%` }}
            className="range-brand h-11 w-full min-w-0 cursor-pointer"
          />
          <span className="hidden w-24 shrink-0 text-sm text-ink-muted sm:block">
            {quantity} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
