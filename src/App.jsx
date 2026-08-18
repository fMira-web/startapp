import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import Header from './components/Header';
import BriefSection from './components/BriefSection';
import ModuleSection from './components/InteractiveModules/ModuleSection';
import StickySummary from './components/Checkout/StickySummary';
import MobileSummaryBar from './components/Checkout/MobileSummaryBar';
import SignedConfirmation from './components/SignedConfirmation';
import AuthScreen from './components/Auth/AuthScreen';
import ProjectHub from './components/Hub/ProjectHub';
import Reveal from './components/Reveal';
import { useTemplate, useQuote, useMeta } from './store/useQuoteStore';
import { useAuthStore } from './store/useAuthStore';
import { useHubStore } from './store/useHubStore';
import { formatCurrency, formatAlternate, formatDate, FX } from './lib/format';

function MarketSection() {
  const template = useTemplate();
  const market = template.market;
  if (!market) return null;

  return (
    <section aria-labelledby="market-heading" className="mt-20 sm:mt-28">
      <Reveal>
        <div className="border-t border-line pt-8">
          <p className="label-caps">Рынок Узбекистана · август 2026</p>
          <h2
            id="market-heading"
            className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]"
          >
            {market.title}
          </h2>
          <p className="measure mt-3 text-[1.0625rem] leading-relaxed text-ink-muted">
            {market.description}
          </p>
        </div>
      </Reveal>

      <Reveal y={12}>
        <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {market.benchmarks.map((item) => (
            <div key={item.label} className="rounded-card border border-line bg-surface px-5 py-4">
              <dt className="text-xs text-ink-muted">{item.label}</dt>
              <dd className="tnum mt-1.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal y={10}>
        <div className="mt-6 rounded-card border border-line bg-surface-sunken px-5 py-4">
          <p className="tnum text-sm font-medium text-ink-soft">
            {market.fx.label}: {market.fx.value}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {market.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-brand"
                >
                  {source.label}
                  <ExternalLink size={12} strokeWidth={1.6} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

function CommercialTerms() {
  const template = useTemplate();
  const quote = useQuote();
  const meta = useMeta();

  return (
    <section aria-labelledby="terms-heading" className="mt-20 sm:mt-28">
      <Reveal>
        <div className="border-t border-line pt-8">
          <p className="label-caps">Коммерческие условия</p>
          <h2
            id="terms-heading"
            className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]"
          >
            График платежей
          </h2>
          <p className="measure mt-3 text-[1.0625rem] leading-relaxed text-ink-muted">
            Счета выставляются по конфигурации на этой странице. Каждая цифра пересчитывается вместе
            с вашим выбором.
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
              <p className="tnum mt-0.5 text-xs text-ink-muted">
                {formatAlternate(entry.amount, meta)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{entry.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal y={10}>
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          {template.payment.terms} Предложение действительно до{' '}
          {formatDate(template.meta.validUntil, template.meta.locale)}.
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
          {meta.leadContact.name}, {meta.leadContact.role} · {meta.leadContact.email} ·{' '}
          {meta.leadContact.phone}
        </p>
      </div>
      <p className="tnum mt-3 text-xs text-ink-muted">
        Курс {FX.source} на {formatDate(FX.date)}: {FX.uzsPerUsd.toLocaleString('ru-RU')} сум за $1
      </p>
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
        Загружаю ваше предложение
      </span>
    </div>
  );
}

function Proposal() {
  const template = useTemplate();

  return (
    <>
      <a
        href="#proposal-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        К содержанию предложения
      </a>

      <main id="proposal-content" className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-x-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 pb-32 lg:pb-24">
            <BriefSection />

            {template.sections.map((section) => (
              <ModuleSection key={section.id} section={section} />
            ))}

            <MarketSection />
            <CommercialTerms />
            <SignedConfirmation />
            <Footer />
          </div>

          <aside className="hidden lg:block lg:pt-24" aria-label="Итог по конфигурации">
            <StickySummary />
          </aside>
        </div>
      </main>

      <MobileSummaryBar />
    </>
  );
}

export default function App() {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const view = useHubStore((state) => state.view);
  const setView = useHubStore((state) => state.setView);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <BootSplash />;
  if (status === 'anonymous') return <AuthScreen />;

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      {view === 'hub' ? <ProjectHub onBack={() => setView('proposal')} /> : <Proposal />}
    </div>
  );
}
