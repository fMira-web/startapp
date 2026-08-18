import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ChevronUp, LayoutGrid, Loader2 } from 'lucide-react';
import { useQuote, useMeta } from '../../store/useQuoteStore';
import { useAcceptance } from '../../lib/useAcceptance';
import { formatCurrency } from '../../lib/format';
import AnimatedPriceTotal from './AnimatedPriceTotal';
import { SummaryBody } from './StickySummary';
import { ICON, STROKE } from '../../lib/icons';

export default function MobileSummaryBar() {
  const quote = useQuote();
  const meta = useMeta();
  const { acceptance, accepting, accept, openHub } = useAcceptance();
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="sheet"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-3 rounded-t-[0.875rem] border border-b-0 border-line bg-surface px-5 pb-4 pt-5 shadow-[var(--shadow-float)]"
          >
            <p className="label-caps mb-2">Ваша конфигурация</p>
            <SummaryBody quote={quote} meta={meta} compact />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control px-1 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-ink-muted">
                Итого
              </span>
              <AnimatedPriceTotal
                value={quote.total}
                meta={meta}
                className="block text-xl font-semibold tracking-[-0.02em] text-ink"
              />
            </span>
            <motion.span
              aria-hidden="true"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.24 }}
              className="text-ink-muted"
            >
              <ChevronUp size={ICON.md} strokeWidth={STROKE.regular} />
            </motion.span>
            <span className="sr-only">
              {expanded ? 'Скрыть позиции' : 'Показать позиции'}
            </span>
          </button>

          {acceptance ? (
            <button
              type="button"
              onClick={openHub}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
            >
              <LayoutGrid size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
              В Центр
            </button>
          ) : (
            <motion.button
              type="button"
              onClick={accept}
              disabled={accepting}
              aria-busy={accepting || undefined}
              whileTap={reduce || accepting ? undefined : { scale: 0.97 }}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
            >
              {accepting && (
                <Loader2
                  size={ICON.xs}
                  strokeWidth={STROKE.regular}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              Принять и подписать
            </motion.button>
          )}
        </div>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Итого {formatCurrency(quote.total, meta)}
      </div>
    </div>
  );
}
