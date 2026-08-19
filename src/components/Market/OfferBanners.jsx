import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, History, Sparkles } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { toHref } from '../../lib/router';
import { plural } from './ui';

/**
 * Динамические предложения главной.
 *
 * Подборку выбирает сервер: время нарезано на окна по 2–3 суток, номер окна
 * служит зерном случайного выбора из пула акций. Здесь остаётся показать
 * карточки и честно сказать, когда подборка сменится, — обратный отсчёт
 * идёт до `nextRotationAt`, который приехал вместе с данными.
 */

const ACCENTS = {
  brand: {
    card: 'border-brand/20 bg-brand-tint',
    badge: 'bg-brand text-white',
    title: 'text-brand',
  },
  signal: {
    card: 'border-signal/20 bg-signal-tint',
    badge: 'bg-signal text-white',
    title: 'text-signal',
  },
  amber: {
    card: 'border-amber-500/25 bg-amber-50',
    badge: 'bg-amber-500 text-white',
    title: 'text-amber-700',
  },
};

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [target]);

  return useMemo(() => {
    if (!target) return null;
    const left = new Date(target).getTime() - now;
    if (!Number.isFinite(left) || left <= 0) return 'обновляется';
    const hours = Math.floor(left / 3_600_000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} ${plural(days, ['день', 'дня', 'дней'])}`;
    }
    if (hours >= 1) return `${hours} ${plural(hours, ['час', 'часа', 'часов'])}`;
    const minutes = Math.max(1, Math.floor(left / 60_000));
    return `${minutes} ${plural(minutes, ['минуту', 'минуты', 'минут'])}`;
  }, [target, now]);
}

function OfferCard({ offer }) {
  const accent = ACCENTS[offer.accent] ?? ACCENTS.brand;
  return (
    <article className={`flex flex-col rounded-card border p-5 ${accent.card}`}>
      {offer.subtitle && (
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${accent.badge}`}
        >
          {offer.subtitle}
        </span>
      )}
      <h3 className={`mt-3 text-[1.0625rem] font-semibold tracking-[-0.015em] ${accent.title}`}>
        {offer.title}
      </h3>
      {offer.body && <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{offer.body}</p>}
      {offer.ctaLabel && (
        <a
          href={offer.ctaHref?.startsWith('#') ? offer.ctaHref : toHref(offer.ctaHref ?? '/projects')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {offer.ctaLabel}
          <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export default function OfferBanners() {
  const offers = useMarketStore((state) => state.offers);
  const loading = useMarketStore((state) => state.offersLoading);
  const loadOffers = useMarketStore((state) => state.loadOffers);
  const countdown = useCountdown(offers?.nextRotationAt ?? offers?.endsAt);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  if (loading && !offers) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-44 animate-pulse rounded-card border border-line bg-surface-sunken" />
        ))}
      </div>
    );
  }

  if (!offers?.offers?.length) return null;

  return (
    <section aria-labelledby="offers-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
            Актуальные предложения
          </p>
          <h2
            id="offers-heading"
            className="mt-2 text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]"
          >
            Что действует прямо сейчас
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Подборка обновляется раз в {offers.rotationDays}{' '}
            {plural(offers.rotationDays, ['день', 'дня', 'дней'])}
            {countdown ? ` · следующая смена через ${countdown}` : ''}
          </p>
        </div>

        <a
          href={toHref('/offers')}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[0.8125rem] font-medium text-ink-soft transition-colors duration-150 hover:border-brand/40 hover:text-ink"
        >
          <History size={15} strokeWidth={1.7} aria-hidden="true" />
          Прошедшие акции
        </a>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.offers.map((offer) => (
          <OfferCard key={offer.id ?? offer.slug} offer={offer} />
        ))}
      </div>
    </section>
  );
}
