import { useEffect } from 'react';
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Wallet } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate, toHref } from '../../lib/router';
import OfferBanners from './OfferBanners';
import ProjectCard from './ProjectCard';
import ProjectForm from './ProjectForm';
import { Button, Empty, SectionHeading, plural } from './ui';

/**
 * Главная.
 *
 * Порядок блоков продиктован тем, зачем сюда приходят: сначала короткое
 * обещание и форма задачи (её просили держать на видном месте), потом
 * актуальные акции, потом живые задачи с доски. Всё остальное — ниже.
 */

const STEPS = [
  {
    icon: Search,
    title: 'Задача на доске',
    text: 'Заказчик описывает работу, выбирает категорию и вилку бюджета. Публикация бесплатна.',
  },
  {
    icon: Wallet,
    title: 'Отклики с ценой',
    text: 'Программисты предлагают свою сумму и срок. Заказчик сравнивает профили, рейтинг и портфолио.',
  },
  {
    icon: ShieldCheck,
    title: 'Оплата после приёмки',
    text: 'Сумма фиксируется при выборе исполнителя, статус меняется на «В работе», деньги уходят после приёмки.',
  },
];

function CategoryStrip() {
  const meta = useMarketStore((state) => state.meta);
  const setFilter = useMarketStore((state) => state.setFilter);
  if (!meta?.categories?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {meta.categories.map((category) => (
        <a
          key={category.id}
          href={toHref('/projects')}
          onClick={() => setFilter('category', category.id)}
          className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[0.8125rem] font-medium text-ink-soft transition-colors duration-150 hover:border-brand/40 hover:text-brand"
        >
          {category.label}
        </a>
      ))}
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  const meta = useMarketStore((state) => state.meta);
  const highlights = useMarketStore((state) => state.highlights);
  const loadHighlights = useMarketStore((state) => state.loadHighlights);
  const loadTags = useMarketStore((state) => state.loadTags);

  useEffect(() => {
    loadHighlights();
    loadTags();
  }, [loadHighlights, loadTags]);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-20 px-5 py-12 sm:gap-24 sm:px-8 sm:py-16">
      {/* ------------------------------------------------- hero + форма */}
      <section className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div>
          <p className="label-caps">Биржа фриланса · Узбекистан</p>
          <h1 className="mt-3 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.75rem]">
            Задача находит исполнителя за один день
          </h1>
          <p className="measure mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
            Заказчики публикуют работу, программисты называют цену и срок. Роль выбирается один
            раз при регистрации, чтобы каждая сторона видела свой интерфейс без лишнего.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/projects')}>
              Открытые задачи
              <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button tone="secondary" onClick={() => navigate('/developers')}>
              Каталог исполнителей
            </Button>
          </div>

          <dl className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Категорий работ', value: meta?.categories?.length ?? '—' },
              { label: 'Комиссия площадки', value: meta ? `${Math.round(meta.platformFeeRate * 100)}%` : '—' },
              { label: 'Ротация акций', value: meta ? `${meta.rotationDays} дн.` : '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-card border border-line bg-surface px-4 py-3">
                <dt className="text-xs text-ink-muted">{item.label}</dt>
                <dd className="tnum mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Форма создания — на видном месте, в первом экране. */}
        <ProjectForm variant="compact" />
      </section>

      {/* ------------------------------------------------- предложения */}
      <OfferBanners />

      {/* ------------------------------------------------- свежие задачи */}
      <section aria-labelledby="fresh-heading">
        <SectionHeading
          id="fresh-heading"
          eyebrow="Доска проектов"
          title="Свежие открытые задачи"
          description="Отклик занимает минуту: сумма, срок и пара слов о подходе."
          action={
            <Button tone="secondary" size="sm" onClick={() => navigate('/projects')}>
              Все задачи
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Button>
          }
        />

        <div className="mt-7">
          {highlights.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {highlights.map((project) => (
                <ProjectCard key={project.id} project={project} categories={meta?.categories ?? []} />
              ))}
            </div>
          ) : (
            <Empty
              icon={Search}
              title="Пока ни одной открытой задачи"
              hint={
                user?.role === 'client'
                  ? 'Опубликуйте первую — она появится здесь сразу после отправки формы.'
                  : 'Загляните позже или подпишитесь на категорию, которая вам близка.'
              }
              action={
                user?.role === 'client' ? (
                  <Button size="sm" className="mt-1" onClick={() => navigate('/projects/new')}>
                    Разместить задачу
                  </Button>
                ) : null
              }
            />
          )}
        </div>

        <div className="mt-8">
          <p className="label-caps mb-3">Категории</p>
          <CategoryStrip />
        </div>
      </section>

      {/* ------------------------------------------------- как это работает */}
      <section aria-labelledby="how-heading" id="how-it-works">
        <SectionHeading
          id="how-heading"
          eyebrow="Как это работает"
          title="Три шага и понятный статус на каждом"
        />
        <ol className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-card border border-line bg-surface p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-tint text-brand">
                  <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <p className="tnum label-caps mt-4">Шаг {index + 1}</p>
                <h3 className="mt-1.5 text-[0.9375rem] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.text}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-surface-sunken px-5 py-4">
          {['В поиске', 'В работе', 'Завершён'].map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <CheckCircle2 size={15} strokeWidth={1.7} className="text-signal" aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="text-sm text-ink-muted">
            — {plural(3, ['статус', 'статуса', 'статусов'])} заказа, которые видят обе стороны
          </span>
        </div>
      </section>
    </div>
  );
}
