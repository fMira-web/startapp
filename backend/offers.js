import * as market from './market-db.js';

/**
 * Динамические предложения главной страницы.
 *
 * Требование — «обновляется каждые 2–3 дня или выбирает случайно из пула».
 * Здесь это сделано детерминированной ротацией: время делится на окна по
 * OFFER_ROTATION_DAYS суток, номер окна становится зерном генератора, и он
 * тасует пул. Отсюда три полезных свойства:
 *
 *   1. никакой фоновой задачи и cron — подборка вычисляется на лету;
 *   2. все процессы приложения в одном окне показывают одно и то же;
 *   3. каждое окно записывается в market_offer_runs, поэтому «История
 *      изменений / Прошедшие акции» — это просто выборка старых окон.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 2 или 3 дня. Иное значение приводится к 3. */
export const ROTATION_DAYS = (() => {
  const configured = Number(process.env.OFFER_ROTATION_DAYS ?? 3);
  return configured === 2 || configured === 3 ? configured : 3;
})();

/** Сколько карточек показываем одновременно. */
export const SLOTS = Math.max(1, Math.min(6, Number(process.env.OFFER_SLOTS ?? 3)));

/** Начало отсчёта окон. Менять нельзя — сдвинется вся история. */
const EPOCH = Date.UTC(2026, 0, 1);

/* ------------------------------------------------------------------ */
/* Детерминированный случайный выбор                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Взвешенная выборка без повторов: чем выше weight, тем чаще оффер попадает
 * в подборку, но при этом ни один не может занять два слота сразу.
 */
function weightedPick(pool, count, random) {
  const remaining = pool.map((offer) => ({ offer, weight: Math.max(1, Number(offer.weight) || 1) }));
  const chosen = [];
  while (chosen.length < count && remaining.length) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    let ticket = random() * total;
    let index = 0;
    while (index < remaining.length - 1 && ticket > remaining[index].weight) {
      ticket -= remaining[index].weight;
      index += 1;
    }
    chosen.push(remaining[index].offer);
    remaining.splice(index, 1);
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Окна                                                                */
/* ------------------------------------------------------------------ */

export function cycleAt(date = new Date()) {
  return Math.floor((date.getTime() - EPOCH) / (ROTATION_DAYS * DAY_MS));
}

export function cycleWindow(cycle) {
  const startsAt = new Date(EPOCH + cycle * ROTATION_DAYS * DAY_MS);
  const endsAt = new Date(EPOCH + (cycle + 1) * ROTATION_DAYS * DAY_MS);
  return { startsAt, endsAt };
}

/* ------------------------------------------------------------------ */
/* Стартовый пул                                                       */
/* ------------------------------------------------------------------ */

export const SEED_OFFERS = [
  {
    slug: 'zero-fee-first-order',
    title: 'Первый заказ — без комиссии площадки',
    subtitle: 'Для новых заказчиков',
    body: 'Опубликуйте первую задачу и заплатите исполнителю ровно ту сумму, о которой договорились. Комиссию 8% берём на себя.',
    ctaLabel: 'Опубликовать задачу',
    ctaHref: '#new-project',
    accent: 'brand',
    weight: 3,
  },
  {
    slug: 'junior-boost',
    title: 'Неделя Junior-разработчиков',
    subtitle: 'Отклики видны заказчикам первыми',
    body: 'Отклики исполнителей уровня Junior поднимаются в начало списка. Хороший момент собрать первое портфолио на площадке.',
    ctaLabel: 'Смотреть открытые задачи',
    ctaHref: '#projects',
    accent: 'signal',
    weight: 2,
  },
  {
    slug: 'mobile-sprint',
    title: 'Mobile-спринт: iOS и Android',
    subtitle: 'Подборка задач под мобильную разработку',
    body: 'Собрали открытые проекты по Flutter, React Native и нативной разработке. Средний бюджет — от 12 млн сум.',
    ctaLabel: 'Открыть подборку',
    ctaHref: '#projects?category=mobile',
    accent: 'brand',
    weight: 2,
  },
  {
    slug: 'devops-audit',
    title: 'Бесплатный аудит инфраструктуры',
    subtitle: 'DevOps-исполнители площадки',
    body: 'Разместите задачу в категории DevOps и получите короткий аудит текущей инфраструктуры до старта работ.',
    ctaLabel: 'Разместить задачу',
    ctaHref: '#new-project',
    accent: 'amber',
    weight: 1,
  },
  {
    slug: 'design-pack',
    title: 'Дизайн-система под ключ',
    subtitle: 'Фиксированный пакет от UI/UX исполнителей',
    body: 'Компоненты, токены и макеты ключевых экранов за две недели. Пакетная цена держится до конца акции.',
    ctaLabel: 'Найти дизайнера',
    ctaHref: '#developers',
    accent: 'brand',
    weight: 2,
  },
  {
    slug: 'safe-deal',
    title: 'Безопасная сделка по умолчанию',
    subtitle: 'Деньги в резерве до приёмки',
    body: 'Сумма резервируется при выборе исполнителя и уходит ему только после того, как заказчик принял работу.',
    ctaLabel: 'Как это работает',
    ctaHref: '#how-it-works',
    accent: 'signal',
    weight: 1,
  },
  {
    slug: 'senior-hours',
    title: 'Часы Senior-разработчиков',
    subtitle: 'Консультация 60 минут',
    body: 'Разбор архитектуры, код-ревью или план миграции — короткий формат для тех, кому нужен взгляд со стороны.',
    ctaLabel: 'Выбрать специалиста',
    ctaHref: '#developers',
    accent: 'brand',
    weight: 1,
  },
  {
    slug: 'portfolio-week',
    title: 'Неделя портфолио',
    subtitle: 'Профили с кейсами — выше в каталоге',
    body: 'Добавьте три работы в портфолио, и профиль поднимется в каталоге исполнителей до конца окна акции.',
    ctaLabel: 'Заполнить профиль',
    ctaHref: '#profile',
    accent: 'amber',
    weight: 2,
  },
];

/** Идемпотентно заводит стартовый пул. Повторные вызовы ничего не ломают. */
export async function ensureSeedOffers() {
  const existing = await market.listOffers({});
  const known = new Set(existing.map((offer) => offer.slug));
  for (const seed of SEED_OFFERS) {
    if (known.has(seed.slug)) continue;
    await market.createOffer({ ...seed, createdBy: 'system' });
  }
  return (await market.listOffers({})).length;
}

/* ------------------------------------------------------------------ */
/* Текущая подборка и история                                          */
/* ------------------------------------------------------------------ */

function shape(offer) {
  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    subtitle: offer.subtitle,
    body: offer.body,
    ctaLabel: offer.cta_label ?? offer.ctaLabel ?? null,
    ctaHref: offer.cta_href ?? offer.ctaHref ?? null,
    accent: offer.accent,
    weight: offer.weight,
    active: offer.active,
  };
}

/**
 * Подборка текущего окна. Если окно ещё не зафиксировано — фиксируем его
 * здесь же, поэтому первый запрос после ротации и создаёт запись в истории.
 */
export async function currentOffers({ persist = true } = {}) {
  const cycle = cycleAt();
  const { startsAt, endsAt } = cycleWindow(cycle);
  const pool = await market.listOffers({ activeOnly: true });

  if (!pool.length) {
    return { cycle, startsAt, endsAt, rotationDays: ROTATION_DAYS, offers: [] };
  }

  const recorded = await market.runsForCycle(cycle);
  if (recorded.length) {
    const byId = new Map(pool.map((offer) => [offer.id, offer]));
    // Оффер могли выключить или удалить уже после фиксации окна — тогда
    // просто не показываем его, но запись в истории остаётся.
    const offers = recorded
      .map((run) => byId.get(run.offer_id))
      .filter(Boolean)
      .map(shape);
    if (offers.length) {
      return { cycle, startsAt, endsAt, rotationDays: ROTATION_DAYS, offers };
    }
  }

  const random = mulberry32(cycle * 2654435761);
  const picked = weightedPick(pool, Math.min(SLOTS, pool.length), random);

  if (persist) {
    for (const [slot, offer] of picked.entries()) {
      await market.insertRun({
        offerId: offer.id,
        cycle,
        slot,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    }
  }

  return {
    cycle,
    startsAt,
    endsAt,
    rotationDays: ROTATION_DAYS,
    offers: picked.map(shape),
  };
}

/** «История изменений / Прошедшие акции» — окна, которые уже закрылись. */
export async function offersHistory({ limit = 20 } = {}) {
  const cycle = cycleAt();
  const runs = await market.pastRuns(cycle, limit * SLOTS);
  const offers = await market.listOffers({});
  const byId = new Map(offers.map((offer) => [offer.id, offer]));

  const windows = new Map();
  for (const run of runs) {
    const key = String(run.cycle);
    if (!windows.has(key)) {
      windows.set(key, {
        cycle: Number(run.cycle),
        startsAt: run.starts_at,
        endsAt: run.ends_at,
        offers: [],
      });
    }
    const offer = byId.get(run.offer_id);
    windows.get(key).offers.push(
      offer
        ? { ...shape(offer), slot: run.slot }
        : { id: run.offer_id, slot: run.slot, title: 'Предложение удалено', removed: true }
    );
  }

  return [...windows.values()]
    .sort((a, b) => b.cycle - a.cycle)
    .slice(0, limit);
}
