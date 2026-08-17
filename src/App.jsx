import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Header from './components/Header';
import BriefSection from './components/BriefSection';
import ModuleSection from './components/InteractiveModules/ModuleSection';
import StickySummary from './components/Checkout/StickySummary';
import MobileSummaryBar from './components/Checkout/MobileSummaryBar';
import SignedConfirmation from './components/SignedConfirmation';
import AuthScreen from './components/Auth/AuthScreen';
import Reveal from './components/Reveal';
import { useTemplate, useQuote } from './store/useQuoteStore';
import { useAuthStore } from './store/useAuthStore';
import { formatCurrency, formatDate } from './lib/format';

function CommercialTerms() {
  const template = useTemplate();
  const quote = useQuote();
  const meta = template.meta;

  return (
    <section aria-labelledby="terms-heading" className="mt-20 sm:mt-28">
      <Reveal>
        <div className="border-t border-line pt-8">
          <p className="label-caps">Commercial terms</p>
          <h2
            id="terms-heading"
            className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]"
          >
            Payment schedule
          </h2>
          <p className="measure mt-3 text-[1.0625rem] leading-relaxed text-ink-muted">
            Invoiced against the configuration on this page. Every figure updates with your
            selections.
          </p>
        </div>
      </Reveal>

      <Reveal y={12}>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quote.schedule.map((entry, index) => (
            <div key={entry.label} className="rounded-card border border-line bg-surface p-5">
              <p className="tnum label-caps">
                {String(index + 1).padStart(2, '0')} · {Math.round(entry.share * 100)}%
              </p>
              <p className="tnum mt-3 text-xl font-semibold tracking-[-0.02em] text-ink">
                {formatCurrency(entry.amount, meta)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{entry.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal y={10}>
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          {template.payment.terms} This proposal is valid until{' '}
          {formatDate(meta.validUntil, meta.locale)}.
        </p>
      </Reveal>
    </section>
  );
}

function Footer() {
  const meta = useTemplate().meta;
  return (
    <footer className="mt-24 border-t border-line py-10 sm:mt-32">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm text-ink-muted">
          {meta.studio.name} · {meta.studio.site}
        </p>
        <p className="text-sm text-ink-muted">
          {meta.leadContact.name}, {meta.leadContact.role} · {meta.leadContact.email}
        </p>
      </div>
    </footer>
  );
}

function BootSplash() {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <motion.div
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-brand"
        animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="sr-only" role="status">
        Loading your proposal
      </span>
    </div>
  );
}

function Proposal() {
  const template = useTemplate();

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#proposal-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to proposal
      </a>

      <Header />

      <main id="proposal-content" className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-x-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 pb-32 lg:pb-24">
            <BriefSection />

            {template.sections.map((section) => (
              <ModuleSection key={section.id} section={section} />
            ))}

            <CommercialTerms />
            <SignedConfirmation />
            <Footer />
          </div>

          <aside className="hidden lg:block lg:pt-24" aria-label="Quote summary">
            <StickySummary />
          </aside>
        </div>
      </main>

      <MobileSummaryBar />
    </div>
  );
}

export default function App() {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <BootSplash />;
  if (status === 'anonymous') return <AuthScreen />;
  return <Proposal />;
}
