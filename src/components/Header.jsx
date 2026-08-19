import { motion, useScroll, useSpring } from 'framer-motion';
import { Briefcase, CheckCircle2, Code2, FileText, LayoutGrid, LogOut } from 'lucide-react';
import { useQuoteStore, useTemplate } from '../store/useQuoteStore';
import { useAuthStore } from '../store/useAuthStore';
import { useHubStore } from '../store/useHubStore';
import { ICON, STROKE } from '../lib/icons';

function CurrencySwitch() {
  const currencyView = useQuoteStore((state) => state.currencyView);
  const setCurrencyView = useQuoteStore((state) => state.setCurrencyView);

  return (
    <div
      role="group"
      aria-label="Валюта отображения"
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {[
        { id: 'UZS', label: 'сум' },
        { id: 'USD', label: '$' },
      ].map((option) => {
        const active = currencyView === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => setCurrencyView(option.id)}
            className={`min-h-8 cursor-pointer rounded-full px-2.5 text-xs font-semibold transition-colors duration-150 ${
              active ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Header() {
  const template = useTemplate();
  const acceptance = useQuoteStore((state) => state.acceptance);
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const signOut = useAuthStore((state) => state.signOut);
  const view = useHubStore((state) => state.view);
  const setView = useHubStore((state) => state.setView);
  const projectId = useHubStore((state) => state.projectId);

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
              {view === 'hub'
                ? 'Центр проектов'
                : `Предложение ${template.meta.proposalId} · v${template.meta.version}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Вход в Центр проектов нужен и до первой сделки: там заказчик
              описывает свою задачу, а не смотрит готовое предложение. */}
          <button
            type="button"
            onClick={() => setView(view === 'hub' ? 'proposal' : 'hub')}
            className={`min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors duration-150 inline-flex ${
              view === 'hub'
                ? 'bg-brand text-white'
                : 'border border-line bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            <LayoutGrid size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            <span className="hidden sm:inline">
              {view === 'hub' ? 'Пример предложения' : projectId ? 'Центр проектов' : 'Своя задача'}
            </span>
          </button>

          {/* Роль выбирается один раз при регистрации, поэтому здесь она
              показана как факт об аккаунте, а не как переключатель. */}
          {role && (
            <span
              className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft md:inline-flex"
              title="Роль выбрана при регистрации и не меняется"
            >
              {role === 'developer' ? (
                <Code2 size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              ) : (
                <Briefcase size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              )}
              {role === 'developer' ? 'Программист' : 'Заказчик'}
            </span>
          )}

          <CurrencySwitch />

          {acceptance && (
            <span className="hidden items-center gap-1.5 rounded-full bg-signal-tint px-3 py-1.5 text-xs font-medium text-signal ring-1 ring-signal/20 md:inline-flex">
              <CheckCircle2 size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              Принято
            </span>
          )}

          {user && (
            <span className="hidden max-w-[12rem] truncate text-sm text-ink-muted lg:inline">
              {user.fullName || user.email}
            </span>
          )}

          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <LogOut size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            <span className="hidden sm:inline">Выйти</span>
            <span className="sr-only sm:hidden">Выйти</span>
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
