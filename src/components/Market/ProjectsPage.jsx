import { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate } from '../../lib/router';
import ProjectCard from './ProjectCard';
import { Alert, Button, Card, Chip, Empty, Input, Select, Spinner, plural } from './ui';

/**
 * Доска проектов: поиск, фильтры, сортировка.
 *
 * Фильтры уходят на сервер — клиент ничего не режет у себя, поэтому счётчик
 * «найдено» всегда честный, а не «сколько успело приехать».
 */

const SORTS = [
  { id: 'fresh', label: 'Сначала свежие' },
  { id: 'budget', label: 'Сначала дорогие' },
  { id: 'bids', label: 'Больше откликов' },
];

function FilterPanel({ onClose }) {
  const meta = useMarketStore((state) => state.meta);
  const filters = useMarketStore((state) => state.filters);
  const setFilter = useMarketStore((state) => state.setFilter);
  const resetFilters = useMarketStore((state) => state.resetFilters);
  const tags = useMarketStore((state) => state.tags);
  const toggleTag = useMarketStore((state) => state.toggleTag);

  const [budgetMin, setBudgetMin] = useState(filters.budgetMin);
  const [budgetMax, setBudgetMax] = useState(filters.budgetMax);

  useEffect(() => {
    setBudgetMin(filters.budgetMin);
    setBudgetMax(filters.budgetMax);
  }, [filters.budgetMin, filters.budgetMax]);

  const active =
    filters.category ||
    filters.status ||
    filters.level ||
    filters.budgetMin ||
    filters.budgetMax ||
    filters.tags.length > 0;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps inline-flex items-center gap-1.5">
          <Filter size={13} strokeWidth={1.8} aria-hidden="true" />
          Фильтры
        </p>
        {active && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-brand"
          >
            <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
            Сбросить
          </button>
        )}
      </div>

      <Select
        id="filter-category"
        label="Категория"
        value={filters.category}
        onChange={(event) => setFilter('category', event.target.value)}
        options={meta?.categories ?? []}
        placeholder="Все категории"
      />

      <Select
        id="filter-status"
        label="Статус заказа"
        value={filters.status}
        onChange={(event) => setFilter('status', event.target.value)}
        options={meta?.statuses ?? []}
        placeholder="Любой статус"
      />

      <Select
        id="filter-level"
        label="Уровень исполнителя"
        value={filters.level}
        onChange={(event) => setFilter('level', event.target.value)}
        options={meta?.levels ?? []}
        placeholder="Любой уровень"
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-soft">Бюджет, сум</span>
        <div className="flex items-center gap-2">
          <Input
            id="filter-budget-min"
            inputMode="numeric"
            placeholder="от"
            value={budgetMin}
            onChange={(event) => setBudgetMin(event.target.value)}
            onBlur={() => setFilter('budgetMin', budgetMin)}
            className="tnum"
            aria-label="Бюджет от"
          />
          <span aria-hidden="true" className="text-ink-muted">
            —
          </span>
          <Input
            id="filter-budget-max"
            inputMode="numeric"
            placeholder="до"
            value={budgetMax}
            onChange={(event) => setBudgetMax(event.target.value)}
            onBlur={() => setFilter('budgetMax', budgetMax)}
            className="tnum"
            aria-label="Бюджет до"
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-soft">Теги</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 18).map((item) => (
              <Chip
                key={item.tag}
                active={filters.tags.includes(item.tag)}
                onClick={() => toggleTag(item.tag)}
              >
                {item.tag}
                <span className="tnum ml-1 opacity-60">{item.count}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {onClose && (
        <Button tone="secondary" size="sm" onClick={onClose} className="lg:hidden">
          Показать результаты
        </Button>
      )}
    </Card>
  );
}

export default function ProjectsPage() {
  const user = useAuthStore((state) => state.user);
  const meta = useMarketStore((state) => state.meta);
  const feed = useMarketStore((state) => state.feed);
  const filters = useMarketStore((state) => state.filters);
  const setFilter = useMarketStore((state) => state.setFilter);
  const loadFeed = useMarketStore((state) => state.loadFeed);
  const loadTags = useMarketStore((state) => state.loadTags);
  const [search, setSearch] = useState(filters.search);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    loadFeed();
    loadTags();
  }, [loadFeed, loadTags]);

  // Поиск не должен дёргать сервер на каждую букву.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) setFilter('search', search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, filters.search, setFilter]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Доска проектов</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]">
            Открытые задачи
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {feed.loading
              ? 'Ищу подходящие задачи…'
              : `Найдено ${feed.total} ${plural(feed.total, ['задача', 'задачи', 'задач'])}`}
          </p>
        </div>

        {user?.role === 'client' && (
          <Button onClick={() => navigate('/projects/new')}>Разместить задачу</Button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <Button
            tone="secondary"
            onClick={() => setPanelOpen((value) => !value)}
            className="lg:hidden"
          >
            <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
            {panelOpen ? 'Скрыть фильтры' : 'Фильтры'}
          </Button>
          <div className={panelOpen ? 'block' : 'hidden lg:block'}>
            <FilterPanel onClose={() => setPanelOpen(false)} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row">
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
                placeholder="Поиск по названию, описанию и тегам"
                aria-label="Поиск по задачам"
                className="min-h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-3.5 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-brand"
              />
            </label>
            <Select
              id="sort"
              value={filters.sort}
              onChange={(event) => setFilter('sort', event.target.value)}
              options={SORTS}
              className="sm:w-56"
              aria-label="Сортировка"
            />
          </div>

          <div className="mt-6">
            {feed.error ? (
              <Alert tone="error">{feed.error}</Alert>
            ) : feed.loading ? (
              <Spinner label="Загружаю задачи" />
            ) : feed.items.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {feed.items.map((project) => (
                  <ProjectCard key={project.id} project={project} categories={meta?.categories ?? []} />
                ))}
              </div>
            ) : (
              <Empty
                icon={Search}
                title="Под эти фильтры ничего не нашлось"
                hint="Попробуйте убрать часть условий — например, расширить вилку бюджета или снять теги."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
