import { useEffect, useState } from 'react';
import { MapPin, Search, Users } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { toHref } from '../../lib/router';
import { Alert, Avatar, Card, Empty, Rating, Select, Spinner, money, plural } from './ui';

/** Каталог исполнителей: сфера, уровень, ставка, рейтинг и стек. */
export default function DevelopersPage() {
  const meta = useMarketStore((state) => state.meta);
  const developers = useMarketStore((state) => state.developers);
  const devFilters = useMarketStore((state) => state.devFilters);
  const setDevFilter = useMarketStore((state) => state.setDevFilter);
  const loadDevelopers = useMarketStore((state) => state.loadDevelopers);
  const [search, setSearch] = useState(devFilters.search);

  useEffect(() => {
    loadDevelopers();
  }, [loadDevelopers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== devFilters.search) setDevFilter('search', search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, devFilters.search, setDevFilter]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <p className="label-caps">Исполнители</p>
      <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]">
        Кто может взять вашу задачу
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {developers.loading
          ? 'Собираю каталог…'
          : `${developers.total} ${plural(developers.total, ['специалист', 'специалиста', 'специалистов'])}`}
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Стек, специализация, город"
            aria-label="Поиск по исполнителям"
            className="min-h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-3.5 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-brand"
          />
        </label>
        <Select
          id="dev-sphere"
          value={devFilters.sphere}
          onChange={(event) => setDevFilter('sphere', event.target.value)}
          options={meta?.spheres ?? []}
          placeholder="Все сферы"
          className="sm:w-52"
          aria-label="Сфера"
        />
        <Select
          id="dev-level"
          value={devFilters.level}
          onChange={(event) => setDevFilter('level', event.target.value)}
          options={meta?.levels ?? []}
          placeholder="Любой уровень"
          className="sm:w-52"
          aria-label="Уровень"
        />
      </div>

      <div className="mt-8">
        {developers.error ? (
          <Alert tone="error">{developers.error}</Alert>
        ) : developers.loading ? (
          <Spinner label="Загружаю каталог" />
        ) : developers.items.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {developers.items.map((dev) => (
              <Card key={dev.id} className="flex flex-col p-5 transition-shadow duration-200 hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <Avatar user={dev} size={44} />
                  <div className="min-w-0">
                    <a
                      href={toHref(`/users/${dev.id}`)}
                      className="block truncate text-[0.9375rem] font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {dev.fullName || 'Исполнитель площадки'}
                    </a>
                    <p className="truncate text-xs text-ink-muted">
                      {dev.headline || (meta?.spheres ?? []).find((s) => s.id === dev.sphere)?.label}
                    </p>
                    <div className="mt-1">
                      <Rating value={dev.rating} count={dev.reviewsCount} size={12} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
                    {(meta?.spheres ?? []).find((s) => s.id === dev.sphere)?.label ?? dev.sphere}
                  </span>
                  <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
                    {(meta?.levels ?? []).find((l) => l.id === dev.level)?.label ?? dev.level}
                  </span>
                  {!dev.available && (
                    <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted">
                      Занят
                    </span>
                  )}
                </div>

                {dev.stack && (
                  <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-muted">{dev.stack}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4">
                  {dev.rateHour > 0 && (
                    <span className="tnum text-sm font-semibold text-ink">
                      {money(dev.rateHour, dev.currency)}/час
                    </span>
                  )}
                  {dev.city && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                      <MapPin size={13} strokeWidth={1.7} aria-hidden="true" />
                      {dev.city}
                    </span>
                  )}
                  <span className="tnum text-xs text-ink-muted">
                    {dev.projectsDone} {plural(dev.projectsDone, ['проект', 'проекта', 'проектов'])}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            icon={Users}
            title="Под эти условия никого не нашлось"
            hint="Снимите фильтр по уровню или сфере — каталог пополняется по мере регистрации."
          />
        )}
      </div>
    </div>
  );
}
