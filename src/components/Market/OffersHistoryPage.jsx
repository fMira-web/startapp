import { useEffect } from 'react';
import { History } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import OfferBanners from './OfferBanners';
import { Card, Empty, Spinner, formatDate, plural } from './ui';

/**
 * История изменений: какие предложения показывались в каждом окне ротации.
 *
 * Каждое окно — запись в market_offer_runs, поэтому список показывает
 * не «что могло быть», а что реально висело на главной в те дни.
 */
export default function OffersHistoryPage() {
  const history = useMarketStore((state) => state.history);
  const loading = useMarketStore((state) => state.historyLoading);
  const loadHistory = useMarketStore((state) => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-14 px-5 py-10 sm:px-8 sm:py-14">
      <OfferBanners />

      <section aria-labelledby="history-heading">
        <p className="label-caps inline-flex items-center gap-1.5">
          <History size={13} strokeWidth={1.8} aria-hidden="true" />
          История изменений
        </p>
        <h1
          id="history-heading"
          className="mt-2 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]"
        >
          Прошедшие акции
        </h1>
        <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          Каждая подборка живёт своё окно и уходит сюда. Ничего не удаляется: если акция
          закончилась, её условия всё равно остаются видимыми.
        </p>

        <div className="mt-8">
          {loading && !history.length ? (
            <Spinner label="Поднимаю архив" />
          ) : history.length ? (
            <ol className="flex flex-col gap-5">
              {history.map((window) => (
                <li key={window.cycle}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="tnum text-sm font-semibold text-ink">
                        {formatDate(window.startsAt)} — {formatDate(window.endsAt)}
                      </p>
                      <p className="tnum text-xs text-ink-muted">
                        окно №{window.cycle} · {window.offers.length}{' '}
                        {plural(window.offers.length, ['предложение', 'предложения', 'предложений'])}
                      </p>
                    </div>

                    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {window.offers.map((offer) => (
                        <li
                          key={`${window.cycle}-${offer.id}`}
                          className="rounded-control border border-line bg-surface-sunken px-4 py-3"
                        >
                          {offer.subtitle && (
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                              {offer.subtitle}
                            </p>
                          )}
                          <p className={`mt-1 text-sm font-semibold ${offer.removed ? 'text-ink-muted' : 'text-ink'}`}>
                            {offer.title}
                          </p>
                          {offer.body && (
                            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-muted">{offer.body}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ol>
          ) : (
            <Empty
              icon={History}
              title="Архив пока пуст"
              hint="Первая запись появится, когда закончится текущее окно ротации."
            />
          )}
        </div>
      </section>
    </div>
  );
}
