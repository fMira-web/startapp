import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, LayoutGrid } from 'lucide-react';
import { useQuoteStore, useTemplate, useMeta } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatDateTime } from '../lib/format';
import { useHubStore } from '../store/useHubStore';
import { ICON, STROKE } from '../lib/icons';

export default function SignedConfirmation() {
  const acceptance = useQuoteStore((state) => state.acceptance);
  const user = useAuthStore((state) => state.user);
  const template = useTemplate();
  const meta = useMeta();
  const setView = useHubStore((state) => state.setView);
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
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">Предложение принято</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            Подписал <span className="font-medium">{user?.fullName || user?.email}</span>{' '}
            {formatDateTime(acceptance.acceptedAt, meta.locale)}, из подтверждённого аккаунта.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Подписанный PDF и первый счёт придут с адреса {template.meta.leadContact.email}. Ваша
            конфигурация зафиксирована в этой версии предложения; любое изменение оформляется
            письменным дополнением.
          </p>

          <button
            type="button"
            onClick={() => setView('hub')}
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
          >
            <LayoutGrid size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
            Открыть Центр проектов
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
