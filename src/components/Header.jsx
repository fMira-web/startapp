import { motion, useScroll, useSpring } from 'framer-motion';
import { CheckCircle2, FileText, LogOut } from 'lucide-react';
import { useQuoteStore, useTemplate } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { ICON, STROKE } from '../lib/icons';

export default function Header() {
  const template = useTemplate();
  const acceptance = useQuoteStore((state) => state.acceptance);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 34, mass: 0.4 });

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand text-white"
          >
            <FileText size={ICON.sm} strokeWidth={STROKE.regular} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
              {template.meta.studio.name}
            </p>
            <p className="truncate text-xs text-ink-muted">
              Proposal {template.meta.proposalId} · v{template.meta.version}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {acceptance && (
            <span className="hidden items-center gap-1.5 rounded-full bg-signal-tint px-3 py-1.5 text-xs font-medium text-signal ring-1 ring-signal/20 sm:inline-flex">
              <CheckCircle2 size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              Accepted
            </span>
          )}

          {user && (
            <span className="hidden max-w-[14rem] truncate text-sm text-ink-muted md:inline">
              {user.fullName || user.email}
            </span>
          )}

          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <LogOut size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
            <span className="sr-only sm:hidden">Sign out</span>
          </button>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        className="h-px origin-left bg-brand"
        style={{ scaleX: progress }}
      />
    </header>
  );
}
