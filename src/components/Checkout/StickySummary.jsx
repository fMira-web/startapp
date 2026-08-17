import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useTemplate, useQuote } from '../../store/useQuoteStore';
import { useAcceptance } from '../../lib/useAcceptance';
import { formatCurrency, formatSignedCurrency } from '../../lib/format';
import AnimatedPriceTotal from './AnimatedPriceTotal';
import { ICON, STROKE } from '../../lib/icons';

function Row({ children, className = '' }) {
  return <div className={`flex items-baseline justify-between gap-4 ${className}`}>{children}</div>;
}

export function SummaryLines({ quote, meta }) {
  const reduce = useReducedMotion();

  return (
    <ul className="flex flex-col">
      <AnimatePresence initial={false}>
        {quote.lines.map((line) => (
          <motion.li
            key={line.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-baseline justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-medium text-ink-soft">{line.name}</p>
                {line.detail && (
                  <p className="tnum mt-0.5 truncate text-xs text-ink-muted">{line.detail}</p>
                )}
              </div>
              <p className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                {line.amount > 0 ? formatCurrency(line.amount, meta) : 'Included'}
              </p>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function SummaryBody({ quote, meta, compact = false }) {
  const reduce = useReducedMotion();

  return (
    <div className={compact ? '' : 'px-5 pb-5'}>
      <div className="max-h-[38vh] overflow-y-auto pr-1">
        <SummaryLines quote={quote} meta={meta} />
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <Row className="py-1">
          <span className="text-[0.8125rem] text-ink-muted">Subtotal</span>
          <span className="tnum text-[0.8125rem] font-medium text-ink">
            {formatCurrency(quote.subtotal, meta)}
          </span>
        </Row>

        <AnimatePresence initial={false}>
          {quote.appliedDiscounts.map((discount) => (
            <motion.div
              key={discount.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Row className="py-1">
                <span className="flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] text-signal">
                  <span className="truncate">{discount.label}</span>
                  {discount.display && (
                    <span className="tnum shrink-0 text-xs opacity-80">{discount.display}</span>
                  )}
                </span>
                <span className="tnum shrink-0 text-[0.8125rem] font-medium text-signal">
                  {formatSignedCurrency(-discount.amount, meta)}
                </span>
              </Row>
            </motion.div>
          ))}
        </AnimatePresence>

        <Row className="py-1">
          <span className="text-[0.8125rem] text-ink-muted">
            {meta.tax?.label ?? 'Tax'}
            <span className="tnum"> ({Math.round(quote.taxRate * 1000) / 10}%)</span>
          </span>
          <span className="tnum text-[0.8125rem] font-medium text-ink">
            {formatCurrency(quote.taxAmount, meta)}
          </span>
        </Row>
      </div>
    </div>
  );
}

export default function StickySummary() {
  const template = useTemplate();
  const quote = useQuote();
  const meta = { ...template.meta, tax: template.tax };
  const { acceptance, accepting, acceptError, accept } = useAcceptance();
  const reduce = useReducedMotion();

  return (
    <div className="sticky top-24">
      <motion.div
        layout={!reduce}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="label-caps">Your configuration</p>
          <p className="tnum text-xs text-ink-muted">
            {quote.lines.length} {quote.lines.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="pt-2">
          <SummaryBody quote={quote} meta={meta} />
        </div>

        <div className="border-t border-line bg-surface-sunken/60 px-5 py-5">
          <Row>
            <span className="text-sm font-medium text-ink-soft">Total</span>
            <AnimatedPriceTotal
              value={quote.total}
              locale={meta.locale}
              currency={meta.currency}
              className="text-[1.75rem] font-semibold tracking-[-0.03em] text-ink"
            />
          </Row>

          <p className="mt-1 text-xs text-ink-muted">
            {template.payment.schedule[0].label}:{' '}
            <span className="tnum font-medium text-ink-soft">
              {formatCurrency(quote.schedule[0]?.amount ?? 0, meta)}
            </span>
          </p>

          {acceptance ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-control bg-signal-tint px-4 py-3 ring-1 ring-signal/20">
              <CheckCircle2
                size={ICON.sm}
                strokeWidth={STROKE.regular}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-signal"
              />
              <p className="text-[0.8125rem] leading-relaxed text-signal">
                Accepted. A countersigned copy is on its way to your inbox.
              </p>
            </div>
          ) : (
            <>
              <motion.button
                type="button"
                onClick={accept}
                disabled={accepting}
                aria-busy={accepting || undefined}
                whileTap={reduce || accepting ? undefined : { scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {accepting ? (
                  <>
                    <Loader2
                      size={ICON.sm}
                      strokeWidth={STROKE.regular}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Recording
                  </>
                ) : (
                  <>
                    Accept &amp; Sign Proposal
                    <ArrowRight size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
                  </>
                )}
              </motion.button>

              {acceptError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-tint px-3 py-2"
                >
                  <AlertCircle
                    size={ICON.xs}
                    strokeWidth={STROKE.regular}
                    aria-hidden="true"
                    className="mt-[0.2rem] shrink-0 text-danger"
                  />
                  <p className="text-xs leading-relaxed text-danger">{acceptError}</p>
                </div>
              )}
            </>
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.6875rem] text-ink-muted">
            <Lock size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            Signed as your verified account
          </p>
        </div>
      </motion.div>

      <p className="mt-4 px-1 text-xs leading-relaxed text-ink-muted">{template.payment.terms}</p>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Total {formatCurrency(quote.total, meta)}
      </div>
    </div>
  );
}
