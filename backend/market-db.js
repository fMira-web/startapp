import crypto from 'node:crypto';
import { DB_MODE, query } from './db.js';

/**
 * Слой данных биржи фриланса.
 *
 * Повторяет договорённость `db.js`: с DATABASE_URL это Postgres, без него —
 * адаптер в памяти с тем же интерфейсом, чтобы приложение поднималось
 * локально без единой установленной базы. Идентификаторы генерируются в Node,
 * поэтому расширения pgcrypto/uuid-ossp не нужны.
 *
 * Все справочники (сферы, уровни, категории, статусы) объявлены здесь и
 * переиспользуются маршрутами — один источник правды на бэкенде.
 */

/* ------------------------------------------------------------------ */
/* Справочники                                                         */
/* ------------------------------------------------------------------ */

/** Сфера программиста — выбирается на дополнительном шаге регистрации. */
export const SPHERES = [
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'fullstack', label: 'Fullstack' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'devops', label: 'DevOps' },
  { id: 'design', label: 'UI/UX дизайн' },
  { id: 'qa', label: 'QA / тестирование' },
  { id: 'data', label: 'Data / ML' },
  { id: 'gamedev', label: 'Gamedev' },
];

export const LEVELS = [
  { id: 'junior', label: 'Junior' },
  { id: 'middle', label: 'Middle' },
  { id: 'senior', label: 'Senior' },
  { id: 'lead', label: 'Lead / Architect' },
];

/** Категории проектов на доске. Совпадают со сферами плюс «прочее». */
export const CATEGORIES = [
  ...SPHERES.map((sphere) => ({ ...sphere })),
  { id: 'other', label: 'Другое' },
];

/** Жизненный цикл заказа: В поиске → В работе → Завершён. */
export const PROJECT_STATUSES = [
  { id: 'open', label: 'В поиске' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'completed', label: 'Завершён' },
  { id: 'cancelled', label: 'Отменён' },
];

export const MODERATION_STATES = ['published', 'hidden', 'pending'];

export const SPHERE_IDS = new Set(SPHERES.map((item) => item.id));
export const LEVEL_IDS = new Set(LEVELS.map((item) => item.id));
export const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));
export const STATUS_IDS = new Set(PROJECT_STATUSES.map((item) => item.id));

/* ------------------------------------------------------------------ */
/* Схема                                                               */
/* ------------------------------------------------------------------ */

const MARKET_SCHEMA = `
create table if not exists market_dev_profiles (
  user_id        text primary key references users(id) on delete cascade,
  sphere         text not null,
  level          text not null,
  stack          text not null default '',
  headline       text,
  bio            text,
  city           text,
  rate_hour      bigint not null default 0,
  currency       text not null default 'UZS',
  portfolio      text not null default '[]',
  links          text not null default '{}',
  available      boolean not null default true,
  rating         numeric(3,2) not null default 0,
  reviews_count  integer not null default 0,
  projects_done  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists market_dev_sphere_idx on market_dev_profiles (sphere, level);

create table if not exists market_client_profiles (
  user_id         text primary key references users(id) on delete cascade,
  company         text,
  about           text,
  city            text,
  site            text,
  rating          numeric(3,2) not null default 0,
  reviews_count   integer not null default 0,
  projects_posted integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists market_projects (
  id              text primary key,
  owner_id        text not null references users(id) on delete cascade,
  title           text not null,
  description     text not null default '',
  category        text not null default 'other',
  tags            text not null default '[]',
  budget_min      bigint not null default 0,
  budget_max      bigint not null default 0,
  currency        text not null default 'UZS',
  deadline_days   integer,
  level           text,
  status          text not null default 'open',
  moderation      text not null default 'published',
  moderation_note text,
  assignee_id     text references users(id) on delete set null,
  agreed_amount   bigint,
  bids_count      integer not null default 0,
  views           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index if not exists market_projects_feed_idx on market_projects (status, created_at desc);
create index if not exists market_projects_owner_idx on market_projects (owner_id, created_at desc);
create index if not exists market_projects_category_idx on market_projects (category);
create index if not exists market_projects_assignee_idx on market_projects (assignee_id);

create table if not exists market_bids (
  id         text primary key,
  project_id text not null references market_projects(id) on delete cascade,
  dev_id     text not null references users(id) on delete cascade,
  amount     bigint not null,
  days       integer not null,
  message    text,
  status     text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (project_id, dev_id)
);

create index if not exists market_bids_project_idx on market_bids (project_id, created_at desc);
create index if not exists market_bids_dev_idx on market_bids (dev_id, created_at desc);

create table if not exists market_messages (
  id         text primary key,
  project_id text not null references market_projects(id) on delete cascade,
  author_id  text not null references users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists market_messages_project_idx on market_messages (project_id, created_at);

create table if not exists market_reviews (
  id         text primary key,
  project_id text not null references market_projects(id) on delete cascade,
  author_id  text not null references users(id) on delete cascade,
  target_id  text not null references users(id) on delete cascade,
  rating     integer not null,
  comment    text,
  created_at timestamptz not null default now(),
  unique (project_id, author_id)
);

create index if not exists market_reviews_target_idx on market_reviews (target_id, created_at desc);

create table if not exists market_events (
  id         text primary key,
  project_id text not null references market_projects(id) on delete cascade,
  kind       text not null,
  message    text not null,
  actor_id   text,
  created_at timestamptz not null default now()
);

create index if not exists market_events_project_idx on market_events (project_id, created_at);

create table if not exists market_offers (
  id         text primary key,
  slug       text not null unique,
  title      text not null,
  subtitle   text,
  body       text,
  cta_label  text,
  cta_href   text,
  accent     text not null default 'brand',
  weight     integer not null default 1,
  active     boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_offer_runs (
  id         text primary key,
  offer_id   text not null references market_offers(id) on delete cascade,
  cycle      bigint not null,
  slot       integer not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  unique (cycle, offer_id)
);

create index if not exists market_offer_runs_cycle_idx on market_offer_runs (cycle desc, slot);

create table if not exists market_admin_log (
  id          text primary key,
  actor_id    text,
  actor_email text,
  action      text not null,
  target      text,
  details     text,
  created_at  timestamptz not null default now()
);

create index if not exists market_admin_log_idx on market_admin_log (created_at desc);
`;

export async function initMarketDb() {
  if (DB_MODE === 'memory') return { mode: 'memory' };
  await query(MARKET_SCHEMA);
  return { mode: 'postgres' };
}

/* ------------------------------------------------------------------ */
/* Хранилище в памяти                                                  */
/* ------------------------------------------------------------------ */

const mem = {
  devProfiles: new Map(), // user_id -> row
  clientProfiles: new Map(),
  projects: [],
  bids: [],
  messages: [],
  reviews: [],
  events: [],
  offers: [],
  offerRuns: [],
  adminLog: [],
};

export const memoryStore = mem;

/* ------------------------------------------------------------------ */
/* Вспомогательное                                                     */
/* ------------------------------------------------------------------ */

const id = () => crypto.randomUUID();
const now = () => new Date();

function toInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

export function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Теги приводятся к нижнему регистру — иначе фильтр по ним не сходится. */
export function normaliseTags(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(/[,;]/)
        .map((tag) => tag.trim());
  const seen = new Set();
  const result = [];
  for (const tag of raw) {
    const clean = String(tag ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 32);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= 12) break;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Профиль программиста                                                */
/* ------------------------------------------------------------------ */

export async function getDevProfile(userId) {
  if (DB_MODE === 'memory') return mem.devProfiles.get(userId) ?? null;
  const rows = await query('select * from market_dev_profiles where user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function upsertDevProfile(userId, input = {}) {
  const existing = await getDevProfile(userId);
  const row = {
    user_id: userId,
    sphere: input.sphere ?? existing?.sphere ?? 'fullstack',
    level: input.level ?? existing?.level ?? 'middle',
    stack: input.stack ?? existing?.stack ?? '',
    headline: input.headline ?? existing?.headline ?? null,
    bio: input.bio ?? existing?.bio ?? null,
    city: input.city ?? existing?.city ?? null,
    rate_hour: toInt(input.rateHour ?? existing?.rate_hour ?? 0),
    currency: input.currency ?? existing?.currency ?? 'UZS',
    portfolio: JSON.stringify(input.portfolio ?? parseJson(existing?.portfolio, []) ?? []),
    links: JSON.stringify(input.links ?? parseJson(existing?.links, {}) ?? {}),
    available: input.available ?? existing?.available ?? true,
    rating: Number(existing?.rating ?? 0),
    reviews_count: toInt(existing?.reviews_count ?? 0),
    projects_done: toInt(existing?.projects_done ?? 0),
    created_at: existing?.created_at ?? now(),
    updated_at: now(),
  };

  if (DB_MODE === 'memory') {
    mem.devProfiles.set(userId, row);
    return row;
  }

  const rows = await query(
    `insert into market_dev_profiles
       (user_id, sphere, level, stack, headline, bio, city, rate_hour, currency, portfolio, links, available)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (user_id) do update set
       sphere = excluded.sphere,
       level = excluded.level,
       stack = excluded.stack,
       headline = excluded.headline,
       bio = excluded.bio,
       city = excluded.city,
       rate_hour = excluded.rate_hour,
       currency = excluded.currency,
       portfolio = excluded.portfolio,
       links = excluded.links,
       available = excluded.available,
       updated_at = now()
     returning *`,
    [
      userId,
      row.sphere,
      row.level,
      row.stack,
      row.headline,
      row.bio,
      row.city,
      row.rate_hour,
      row.currency,
      row.portfolio,
      row.links,
      row.available,
    ]
  );
  return rows[0];
}

/**
 * Каталог исполнителей с фильтрами. `users` подмешивается вызывающей
 * стороной — здесь возвращаются только строки профилей.
 */
export async function listDevProfiles({
  sphere = null,
  level = null,
  search = '',
  available = null,
  limit = 60,
  offset = 0,
} = {}) {
  const needle = String(search ?? '').trim().toLowerCase();

  if (DB_MODE === 'memory') {
    const all = [...mem.devProfiles.values()]
      .filter((row) => (sphere ? row.sphere === sphere : true))
      .filter((row) => (level ? row.level === level : true))
      .filter((row) => (available === null ? true : row.available === available))
      .filter((row) =>
        needle ? `${row.stack} ${row.headline ?? ''} ${row.city ?? ''}`.toLowerCase().includes(needle) : true
      )
      .sort((a, b) => Number(b.rating) - Number(a.rating) || b.projects_done - a.projects_done);
    return { profiles: all.slice(offset, offset + limit), total: all.length };
  }

  const where = [];
  const params = [];
  if (sphere) {
    params.push(sphere);
    where.push(`sphere = $${params.length}`);
  }
  if (level) {
    params.push(level);
    where.push(`level = $${params.length}`);
  }
  if (available !== null) {
    params.push(available);
    where.push(`available = $${params.length}`);
  }
  if (needle) {
    params.push(`%${needle}%`);
    where.push(
      `(lower(stack) like $${params.length} or lower(coalesce(headline, '')) like $${params.length} or lower(coalesce(city, '')) like $${params.length})`
    );
  }
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  const totals = await query(`select count(*)::int as count from market_dev_profiles ${clause}`, params);
  const rows = await query(
    `select * from market_dev_profiles ${clause}
     order by rating desc, projects_done desc
     limit ${toInt(limit, 60)} offset ${toInt(offset, 0)}`,
    params
  );
  return { profiles: rows, total: totals[0]?.count ?? rows.length };
}

/* ------------------------------------------------------------------ */
/* Профиль заказчика                                                   */
/* ------------------------------------------------------------------ */

export async function getClientProfile(userId) {
  if (DB_MODE === 'memory') return mem.clientProfiles.get(userId) ?? null;
  const rows = await query('select * from market_client_profiles where user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function upsertClientProfile(userId, input = {}) {
  const existing = await getClientProfile(userId);
  const row = {
    user_id: userId,
    company: input.company ?? existing?.company ?? null,
    about: input.about ?? existing?.about ?? null,
    city: input.city ?? existing?.city ?? null,
    site: input.site ?? existing?.site ?? null,
    rating: Number(existing?.rating ?? 0),
    reviews_count: toInt(existing?.reviews_count ?? 0),
    projects_posted: toInt(existing?.projects_posted ?? 0),
    created_at: existing?.created_at ?? now(),
    updated_at: now(),
  };

  if (DB_MODE === 'memory') {
    mem.clientProfiles.set(userId, row);
    return row;
  }

  const rows = await query(
    `insert into market_client_profiles (user_id, company, about, city, site)
     values ($1, $2, $3, $4, $5)
     on conflict (user_id) do update set
       company = excluded.company,
       about = excluded.about,
       city = excluded.city,
       site = excluded.site,
       updated_at = now()
     returning *`,
    [userId, row.company, row.about, row.city, row.site]
  );
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* Проекты                                                             */
/* ------------------------------------------------------------------ */

export async function createProject(input) {
  const row = {
    id: id(),
    owner_id: input.ownerId,
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? 'other',
    tags: JSON.stringify(normaliseTags(input.tags)),
    budget_min: toInt(input.budgetMin, 0),
    budget_max: toInt(input.budgetMax, 0),
    currency: input.currency ?? 'UZS',
    deadline_days: input.deadlineDays == null ? null : toInt(input.deadlineDays),
    level: input.level ?? null,
    status: 'open',
    moderation: 'published',
    moderation_note: null,
    assignee_id: null,
    agreed_amount: null,
    bids_count: 0,
    views: 0,
    created_at: now(),
    updated_at: now(),
    started_at: null,
    completed_at: null,
  };

  if (DB_MODE === 'memory') {
    mem.projects.push(row);
    return row;
  }

  const rows = await query(
    `insert into market_projects
       (id, owner_id, title, description, category, tags, budget_min, budget_max, currency, deadline_days, level)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      row.id,
      row.owner_id,
      row.title,
      row.description,
      row.category,
      row.tags,
      row.budget_min,
      row.budget_max,
      row.currency,
      row.deadline_days,
      row.level,
    ]
  );
  return rows[0];
}

export async function getProject(projectId) {
  if (DB_MODE === 'memory') return mem.projects.find((row) => row.id === projectId) ?? null;
  const rows = await query('select * from market_projects where id = $1', [projectId]);
  return rows[0] ?? null;
}

const PROJECT_PATCHABLE = new Set([
  'title',
  'description',
  'category',
  'tags',
  'budget_min',
  'budget_max',
  'currency',
  'deadline_days',
  'level',
  'status',
  'moderation',
  'moderation_note',
  'assignee_id',
  'agreed_amount',
  'started_at',
  'completed_at',
  'bids_count',
  'views',
]);

export async function updateProject(projectId, patch = {}) {
  const entries = Object.entries(patch).filter(
    ([key, value]) => PROJECT_PATCHABLE.has(key) && value !== undefined
  );
  if (!entries.length) return getProject(projectId);

  if (DB_MODE === 'memory') {
    const project = mem.projects.find((row) => row.id === projectId);
    if (!project) return null;
    for (const [key, value] of entries) project[key] = value;
    project.updated_at = now();
    return project;
  }

  const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  const rows = await query(
    `update market_projects set ${sets}, updated_at = now() where id = $1 returning *`,
    [projectId, ...entries.map(([, value]) => value)]
  );
  return rows[0] ?? null;
}

export async function deleteProject(projectId) {
  if (DB_MODE === 'memory') {
    const index = mem.projects.findIndex((row) => row.id === projectId);
    if (index === -1) return false;
    mem.projects.splice(index, 1);
    mem.bids = mem.bids.filter((bid) => bid.project_id !== projectId);
    mem.messages = mem.messages.filter((msg) => msg.project_id !== projectId);
    mem.reviews = mem.reviews.filter((review) => review.project_id !== projectId);
    mem.events = mem.events.filter((event) => event.project_id !== projectId);
    return true;
  }
  const rows = await query('delete from market_projects where id = $1 returning id', [projectId]);
  return rows.length > 0;
}

/**
 * Витрина доски: поиск по тексту, фильтры по категории, бюджету, тегам,
 * уровню и статусу. `includeHidden` открыт только администраторам.
 */
export async function listProjects({
  search = '',
  category = null,
  tags = [],
  budgetMin = null,
  budgetMax = null,
  status = null,
  level = null,
  ownerId = null,
  assigneeId = null,
  includeHidden = false,
  sort = 'fresh',
  limit = 24,
  offset = 0,
} = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const wantedTags = normaliseTags(tags);

  if (DB_MODE === 'memory') {
    let all = mem.projects.slice();
    if (!includeHidden) all = all.filter((row) => row.moderation === 'published');
    if (category) all = all.filter((row) => row.category === category);
    if (status) all = all.filter((row) => row.status === status);
    if (level) all = all.filter((row) => row.level === level);
    if (ownerId) all = all.filter((row) => row.owner_id === ownerId);
    if (assigneeId) all = all.filter((row) => row.assignee_id === assigneeId);
    if (budgetMin != null) all = all.filter((row) => Number(row.budget_max) >= Number(budgetMin));
    if (budgetMax != null) all = all.filter((row) => Number(row.budget_min) <= Number(budgetMax));
    if (wantedTags.length) {
      all = all.filter((row) => {
        const rowTags = parseJson(row.tags, []);
        return wantedTags.every((tag) => rowTags.includes(tag));
      });
    }
    if (needle) {
      all = all.filter((row) =>
        `${row.title} ${row.description} ${row.tags}`.toLowerCase().includes(needle)
      );
    }

    const sorters = {
      fresh: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      budget: (a, b) => Number(b.budget_max) - Number(a.budget_max),
      bids: (a, b) => b.bids_count - a.bids_count,
    };
    all.sort(sorters[sort] ?? sorters.fresh);
    return { projects: all.slice(offset, offset + limit), total: all.length };
  }

  const where = [];
  const params = [];
  if (!includeHidden) where.push(`moderation = 'published'`);
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (level) {
    params.push(level);
    where.push(`level = $${params.length}`);
  }
  if (ownerId) {
    params.push(ownerId);
    where.push(`owner_id = $${params.length}`);
  }
  if (assigneeId) {
    params.push(assigneeId);
    where.push(`assignee_id = $${params.length}`);
  }
  if (budgetMin != null) {
    params.push(toInt(budgetMin));
    where.push(`budget_max >= $${params.length}`);
  }
  if (budgetMax != null) {
    params.push(toInt(budgetMax));
    where.push(`budget_min <= $${params.length}`);
  }
  for (const tag of wantedTags) {
    // Теги лежат JSON-массивом строк в нижнем регистре, поэтому точное
    // вхождение `"tag"` — корректная проверка принадлежности.
    params.push(`%"${tag}"%`);
    where.push(`tags like $${params.length}`);
  }
  if (needle) {
    params.push(`%${needle}%`);
    where.push(
      `(lower(title) like $${params.length} or lower(description) like $${params.length} or lower(tags) like $${params.length})`
    );
  }
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  const order =
    sort === 'budget'
      ? 'budget_max desc, created_at desc'
      : sort === 'bids'
        ? 'bids_count desc, created_at desc'
        : 'created_at desc';

  const totals = await query(`select count(*)::int as count from market_projects ${clause}`, params);
  const rows = await query(
    `select * from market_projects ${clause} order by ${order} limit ${toInt(limit, 24)} offset ${toInt(offset, 0)}`,
    params
  );
  return { projects: rows, total: totals[0]?.count ?? rows.length };
}

export async function bumpProjectViews(projectId) {
  if (DB_MODE === 'memory') {
    const project = mem.projects.find((row) => row.id === projectId);
    if (project) project.views = toInt(project.views) + 1;
    return;
  }
  await query('update market_projects set views = views + 1 where id = $1', [projectId]);
}

/** Все теги с частотой — для облака фильтров на доске. */
export async function popularTags(limit = 24) {
  const counter = new Map();
  const rows =
    DB_MODE === 'memory'
      ? mem.projects.filter((row) => row.moderation === 'published')
      : await query(`select tags from market_projects where moderation = 'published'`);
  for (const row of rows) {
    for (const tag of parseJson(row.tags, [])) {
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

/* ------------------------------------------------------------------ */
/* Отклики                                                             */
/* ------------------------------------------------------------------ */

export async function createBid({ projectId, devId, amount, days, message = null }) {
  const row = {
    id: id(),
    project_id: projectId,
    dev_id: devId,
    amount: toInt(amount),
    days: toInt(days),
    message,
    status: 'pending',
    created_at: now(),
  };

  if (DB_MODE === 'memory') {
    const existing = mem.bids.find((bid) => bid.project_id === projectId && bid.dev_id === devId);
    if (existing) {
      Object.assign(existing, { amount: row.amount, days: row.days, message, status: 'pending' });
      return existing;
    }
    mem.bids.push(row);
    return row;
  }

  const rows = await query(
    `insert into market_bids (id, project_id, dev_id, amount, days, message)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (project_id, dev_id) do update set
       amount = excluded.amount,
       days = excluded.days,
       message = excluded.message,
       status = 'pending',
       created_at = now()
     returning *`,
    [row.id, projectId, devId, row.amount, row.days, message]
  );
  return rows[0];
}

export async function listBids(projectId) {
  if (DB_MODE === 'memory') {
    return mem.bids
      .filter((bid) => bid.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return query('select * from market_bids where project_id = $1 order by created_at desc', [projectId]);
}

export async function listBidsByDev(devId) {
  if (DB_MODE === 'memory') {
    return mem.bids
      .filter((bid) => bid.dev_id === devId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return query('select * from market_bids where dev_id = $1 order by created_at desc', [devId]);
}

export async function getBid(bidId) {
  if (DB_MODE === 'memory') return mem.bids.find((bid) => bid.id === bidId) ?? null;
  const rows = await query('select * from market_bids where id = $1', [bidId]);
  return rows[0] ?? null;
}

export async function setBidStatus(bidId, status) {
  if (DB_MODE === 'memory') {
    const bid = mem.bids.find((entry) => entry.id === bidId);
    if (bid) bid.status = status;
    return bid ?? null;
  }
  const rows = await query('update market_bids set status = $2 where id = $1 returning *', [bidId, status]);
  return rows[0] ?? null;
}

export async function declineOtherBids(projectId, keepId) {
  if (DB_MODE === 'memory') {
    for (const bid of mem.bids) {
      if (bid.project_id === projectId && bid.id !== keepId && bid.status === 'pending') {
        bid.status = 'declined';
      }
    }
    return;
  }
  await query(
    `update market_bids set status = 'declined' where project_id = $1 and id <> $2 and status = 'pending'`,
    [projectId, keepId]
  );
}

export async function deleteBid(bidId) {
  if (DB_MODE === 'memory') {
    const index = mem.bids.findIndex((bid) => bid.id === bidId);
    if (index === -1) return false;
    mem.bids.splice(index, 1);
    return true;
  }
  const rows = await query('delete from market_bids where id = $1 returning id', [bidId]);
  return rows.length > 0;
}

export async function countBids(projectId) {
  if (DB_MODE === 'memory') return mem.bids.filter((bid) => bid.project_id === projectId).length;
  const rows = await query('select count(*)::int as count from market_bids where project_id = $1', [
    projectId,
  ]);
  return rows[0]?.count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Переписка                                                           */
/* ------------------------------------------------------------------ */

export async function addMessage({ projectId, authorId, body }) {
  const row = {
    id: id(),
    project_id: projectId,
    author_id: authorId,
    body,
    created_at: now(),
  };
  if (DB_MODE === 'memory') {
    mem.messages.push(row);
    return row;
  }
  const rows = await query(
    'insert into market_messages (id, project_id, author_id, body) values ($1, $2, $3, $4) returning *',
    [row.id, projectId, authorId, body]
  );
  return rows[0];
}

export async function listMessages(projectId, limit = 200) {
  if (DB_MODE === 'memory') {
    return mem.messages
      .filter((row) => row.project_id === projectId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-limit);
  }
  const rows = await query(
    `select * from market_messages where project_id = $1 order by created_at desc limit ${toInt(limit, 200)}`,
    [projectId]
  );
  return rows.reverse();
}

/* ------------------------------------------------------------------ */
/* Отзывы и рейтинг                                                    */
/* ------------------------------------------------------------------ */

export async function addReview({ projectId, authorId, targetId, rating, comment = null }) {
  const row = {
    id: id(),
    project_id: projectId,
    author_id: authorId,
    target_id: targetId,
    rating: Math.max(1, Math.min(5, toInt(rating, 5))),
    comment,
    created_at: now(),
  };

  if (DB_MODE === 'memory') {
    const existing = mem.reviews.find(
      (review) => review.project_id === projectId && review.author_id === authorId
    );
    if (existing) {
      Object.assign(existing, { rating: row.rating, comment, target_id: targetId });
      return existing;
    }
    mem.reviews.push(row);
    return row;
  }

  const rows = await query(
    `insert into market_reviews (id, project_id, author_id, target_id, rating, comment)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (project_id, author_id) do update set
       rating = excluded.rating,
       comment = excluded.comment,
       target_id = excluded.target_id
     returning *`,
    [row.id, projectId, authorId, targetId, row.rating, comment]
  );
  return rows[0];
}

export async function listReviewsFor(targetId, limit = 50) {
  if (DB_MODE === 'memory') {
    return mem.reviews
      .filter((review) => review.target_id === targetId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }
  return query(
    `select * from market_reviews where target_id = $1 order by created_at desc limit ${toInt(limit, 50)}`,
    [targetId]
  );
}

export async function listReviewsForProject(projectId) {
  if (DB_MODE === 'memory') return mem.reviews.filter((review) => review.project_id === projectId);
  return query('select * from market_reviews where project_id = $1', [projectId]);
}

/** Пересчитывает средний балл и кладёт его в профиль — читать дешевле. */
export async function recomputeRating(targetId, role) {
  const reviews = await listReviewsFor(targetId, 10_000);
  const count = reviews.length;
  const average = count
    ? Math.round((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / count) * 100) / 100
    : 0;

  if (DB_MODE === 'memory') {
    const store = role === 'developer' ? mem.devProfiles : mem.clientProfiles;
    const profile = store.get(targetId);
    if (profile) {
      profile.rating = average;
      profile.reviews_count = count;
    }
    return { rating: average, reviewsCount: count };
  }

  const table = role === 'developer' ? 'market_dev_profiles' : 'market_client_profiles';
  await query(`update ${table} set rating = $2, reviews_count = $3 where user_id = $1`, [
    targetId,
    average,
    count,
  ]);
  return { rating: average, reviewsCount: count };
}

export async function bumpCounter(userId, role, field) {
  if (DB_MODE === 'memory') {
    const store = role === 'developer' ? mem.devProfiles : mem.clientProfiles;
    const profile = store.get(userId);
    if (profile) profile[field] = toInt(profile[field]) + 1;
    return;
  }
  const table = role === 'developer' ? 'market_dev_profiles' : 'market_client_profiles';
  await query(`update ${table} set ${field} = ${field} + 1 where user_id = $1`, [userId]);
}

/* ------------------------------------------------------------------ */
/* Лента событий проекта                                               */
/* ------------------------------------------------------------------ */

export async function addEvent({ projectId, kind, message, actorId = null }) {
  const row = { id: id(), project_id: projectId, kind, message, actor_id: actorId, created_at: now() };
  if (DB_MODE === 'memory') {
    mem.events.push(row);
    return row;
  }
  const rows = await query(
    'insert into market_events (id, project_id, kind, message, actor_id) values ($1, $2, $3, $4, $5) returning *',
    [row.id, projectId, kind, message, actorId]
  );
  return rows[0];
}

export async function listEvents(projectId) {
  if (DB_MODE === 'memory') {
    return mem.events
      .filter((row) => row.project_id === projectId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return query('select * from market_events where project_id = $1 order by created_at', [projectId]);
}

/* ------------------------------------------------------------------ */
/* Предложения главной страницы                                        */
/* ------------------------------------------------------------------ */

export async function listOffers({ activeOnly = false } = {}) {
  if (DB_MODE === 'memory') {
    return mem.offers
      .filter((offer) => (activeOnly ? offer.active : true))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const clause = activeOnly ? 'where active = true' : '';
  return query(`select * from market_offers ${clause} order by created_at desc`);
}

export async function getOffer(offerId) {
  if (DB_MODE === 'memory') return mem.offers.find((offer) => offer.id === offerId) ?? null;
  const rows = await query('select * from market_offers where id = $1', [offerId]);
  return rows[0] ?? null;
}

export async function createOffer(input) {
  const row = {
    id: id(),
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle ?? null,
    body: input.body ?? null,
    cta_label: input.ctaLabel ?? null,
    cta_href: input.ctaHref ?? null,
    accent: input.accent ?? 'brand',
    weight: toInt(input.weight, 1),
    active: input.active !== false,
    created_by: input.createdBy ?? null,
    created_at: now(),
    updated_at: now(),
  };

  if (DB_MODE === 'memory') {
    const existing = mem.offers.find((offer) => offer.slug === row.slug);
    if (existing) return existing;
    mem.offers.push(row);
    return row;
  }

  const rows = await query(
    `insert into market_offers (id, slug, title, subtitle, body, cta_label, cta_href, accent, weight, active, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (slug) do nothing
     returning *`,
    [
      row.id,
      row.slug,
      row.title,
      row.subtitle,
      row.body,
      row.cta_label,
      row.cta_href,
      row.accent,
      row.weight,
      row.active,
      row.created_by,
    ]
  );
  if (rows[0]) return rows[0];
  const existing = await query('select * from market_offers where slug = $1', [row.slug]);
  return existing[0] ?? null;
}

const OFFER_PATCHABLE = new Set([
  'title',
  'subtitle',
  'body',
  'cta_label',
  'cta_href',
  'accent',
  'weight',
  'active',
]);

export async function updateOffer(offerId, patch = {}) {
  const entries = Object.entries(patch).filter(
    ([key, value]) => OFFER_PATCHABLE.has(key) && value !== undefined
  );
  if (!entries.length) return getOffer(offerId);

  if (DB_MODE === 'memory') {
    const offer = mem.offers.find((row) => row.id === offerId);
    if (!offer) return null;
    for (const [key, value] of entries) offer[key] = value;
    offer.updated_at = now();
    return offer;
  }

  const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  const rows = await query(
    `update market_offers set ${sets}, updated_at = now() where id = $1 returning *`,
    [offerId, ...entries.map(([, value]) => value)]
  );
  return rows[0] ?? null;
}

export async function deleteOffer(offerId) {
  if (DB_MODE === 'memory') {
    const index = mem.offers.findIndex((offer) => offer.id === offerId);
    if (index === -1) return false;
    mem.offers.splice(index, 1);
    mem.offerRuns = mem.offerRuns.filter((run) => run.offer_id !== offerId);
    return true;
  }
  const rows = await query('delete from market_offers where id = $1 returning id', [offerId]);
  return rows.length > 0;
}

/* --- окна ротации --------------------------------------------------- */

export async function runsForCycle(cycle) {
  if (DB_MODE === 'memory') {
    return mem.offerRuns.filter((run) => run.cycle === cycle).sort((a, b) => a.slot - b.slot);
  }
  return query('select * from market_offer_runs where cycle = $1 order by slot', [String(cycle)]);
}

export async function insertRun({ offerId, cycle, slot, startsAt, endsAt }) {
  const row = {
    id: id(),
    offer_id: offerId,
    cycle,
    slot,
    starts_at: startsAt,
    ends_at: endsAt,
    created_at: now(),
  };
  if (DB_MODE === 'memory') {
    const clash = mem.offerRuns.find((run) => run.cycle === cycle && run.offer_id === offerId);
    if (clash) return clash;
    mem.offerRuns.push(row);
    return row;
  }
  const rows = await query(
    `insert into market_offer_runs (id, offer_id, cycle, slot, starts_at, ends_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (cycle, offer_id) do nothing
     returning *`,
    [row.id, offerId, String(cycle), slot, startsAt, endsAt]
  );
  return rows[0] ?? row;
}

/** История: все окна, кроме текущего, свежие сверху. */
export async function pastRuns(currentCycle, limit = 60) {
  if (DB_MODE === 'memory') {
    return mem.offerRuns
      .filter((run) => run.cycle < currentCycle)
      .sort((a, b) => b.cycle - a.cycle || a.slot - b.slot)
      .slice(0, limit);
  }
  return query(
    `select * from market_offer_runs where cycle < $1 order by cycle desc, slot limit ${toInt(limit, 60)}`,
    [String(currentCycle)]
  );
}

/* ------------------------------------------------------------------ */
/* Журнал администратора                                               */
/* ------------------------------------------------------------------ */

export async function logAdminAction({ actorId, actorEmail, action, target = null, details = null }) {
  const row = {
    id: id(),
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    target,
    details: typeof details === 'string' ? details : JSON.stringify(details ?? null),
    created_at: now(),
  };
  if (DB_MODE === 'memory') {
    mem.adminLog.unshift(row);
    mem.adminLog = mem.adminLog.slice(0, 500);
    return row;
  }
  const rows = await query(
    `insert into market_admin_log (id, actor_id, actor_email, action, target, details)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [row.id, actorId, actorEmail, action, target, row.details]
  );
  return rows[0];
}

export async function listAdminLog(limit = 100) {
  if (DB_MODE === 'memory') return mem.adminLog.slice(0, limit);
  return query(`select * from market_admin_log order by created_at desc limit ${toInt(limit, 100)}`);
}

/* ------------------------------------------------------------------ */
/* Сводка                                                              */
/* ------------------------------------------------------------------ */

export async function marketStats() {
  if (DB_MODE === 'memory') {
    const published = mem.projects.filter((row) => row.moderation === 'published');
    return {
      projects: mem.projects.length,
      open: published.filter((row) => row.status === 'open').length,
      inProgress: published.filter((row) => row.status === 'in_progress').length,
      completed: published.filter((row) => row.status === 'completed').length,
      hidden: mem.projects.filter((row) => row.moderation !== 'published').length,
      bids: mem.bids.length,
      reviews: mem.reviews.length,
      offers: mem.offers.length,
    };
  }
  const rows = await query(`
    select
      (select count(*) from market_projects)::int                                   as projects,
      (select count(*) from market_projects where status = 'open')::int             as open,
      (select count(*) from market_projects where status = 'in_progress')::int      as "inProgress",
      (select count(*) from market_projects where status = 'completed')::int        as completed,
      (select count(*) from market_projects where moderation <> 'published')::int   as hidden,
      (select count(*) from market_bids)::int                                       as bids,
      (select count(*) from market_reviews)::int                                    as reviews,
      (select count(*) from market_offers)::int                                     as offers
  `);
  return rows[0];
}
