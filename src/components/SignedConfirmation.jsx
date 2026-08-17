import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useQuoteStore, useTemplate } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatDateTime } from '../lib/format';
import { ICON, STROKE } from '../lib/icons';

export default function SignedConfirmation() {
  const acceptance = useQuoteStore((state) => state.acceptance);
  const user = useAuthStore((state) => state.user);
  const meta = useTemplate().meta;
  const reduce = useReducedMotion();

  if (!acceptance) return null;

  return (
    <motion.aside
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-20 rounded-card border border-signal/25 bg-signal-tint px-6 py-6 sm:mt-28 sm:px-8"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-signal ring-1 ring-signal/20"
        >
          <CheckCircle2 size={ICON.md} strokeWidth={STROKE.regular} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">Proposal accepted</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            Signed by <span className="font-medium">{user?.fullName || user?.email}</span> on{' '}
            {formatDateTime(acceptance.acceptedAt, meta.locale)}, from a verified account.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            A countersigned PDF and the first invoice will arrive from {meta.leadContact.email}{' '}
            shortly. Your configuration is locked to this version of the proposal; any later change
            is issued as a written amendment.
          </p>
        </div>
      </div>
    </motion.aside>
  );
}
