import crypto from 'node:crypto';

/**
 * Storage layer.
 *
 * With DATABASE_URL set, this is Postgres (Render Postgres in production).
 * Without it, an in-memory adapter with the identical interface takes over so
 * the app still runs locally with nothing installed — the adapter announces
 * itself loudly and refuses to be used in production.
 *
 * Ids are generated in Node rather than by the database, so no pgcrypto /
 * uuid-ossp extension is required.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const IS_PRODUCTION = (process.env.NODE_ENV ?? 'development') === 'production';

export const DB_MODE = DATABASE_URL ? 'postgres' : 'memory';

const SCHEMA = `
create table if not exists users (
  id            text primary key,
  email         text not null unique,
  password_hash text not null,
  full_name     text,
  phone         text,
  email_verified boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists email_codes (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  code_hash   text not null,
  purpose     text not null default 'verify_email',
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_codes_user_purpose_idx
  on email_codes (user_id, purpose, created_at desc);

create table if not exists dev_profiles (
  id            text primary key,
  user_id       text references users(id) on delete cascade,
  full_name     text not null,
  role          text not null,
  headline      text,
  stack         text not null default '',
  city          text,
  rate_hour     bigint not null default 0,
  rating        numeric(3,2) not null default 5.0,
  projects_done integer not null default 0,
  level         text,
  available     boolean not null default true,
  seeded        boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists projects (
  id          text primary key,
  owner_id    text not null references users(id) on delete cascade,
  proposal_id text not null,
  title       text not null,
  summary     text,
  budget      bigint not null,
  currency    text not null default 'UZS',
  weeks       integer,
  status      text not null default 'open',
  line_items  text not null default '[]',
  created_at  timestamptz not null default now()
);

create index if not exists projects_owner_idx on projects (owner_id, created_at desc);

create table if not exists project_bids (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  dev_id     text not null,
  amount     bigint not null,
  days       integer not null,
  message    text,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists project_bids_project_idx on project_bids (project_id, created_at desc);

create table if not exists project_deals (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  dev_id        text not null,
  amount        bigint not null,
  platform_fee  bigint not null default 0,
  payout        bigint not null,
  status        text not null default 'escrow',
  delivery_url  text,
  delivery_note text,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  released_at   timestamptz
);

create index if not exists project_deals_project_idx on project_deals (project_id);

create table if not exists project_events (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  kind       text not null,
  message    text not null,
  actor      text,
  created_at timestamptz not null default now()
);

create index if not exists project_events_project_idx on project_events (project_id, created_at);

create table if not exists proposal_acceptances (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  proposal_id  text not null,
  total_cents  bigint not null,
  currency     text not null,
  line_items   text not null,
  accepted_at  timestamptz not null default now()
);
`;

/* ------------------------------------------------------------------ */
/* Postgres adapter                                                    */
/* ------------------------------------------------------------------ */

let pool = null;

async function getPool() {
  if (pool) return pool;
  const { default: pg } = await import('pg');
  const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    // Without this, an unreachable host makes every query hang forever and the
    // symptom reaches the user as "the server never answered".
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (error) => {
    console.error('Postgres pool error:', error.message);
  });
  return pool;
}

async function query(text, params = []) {
  const client = await getPool();
  const result = await client.query(text, params);
  return result.rows;
}

/* ------------------------------------------------------------------ */
/* In-memory adapter                                                   */
/* ------------------------------------------------------------------ */

const memory = {
  users: new Map(), // id -> user
  byEmail: new Map(), // email -> id
  codes: [], // newest last
  acceptances: [],
  // «Центр проектов»
  devs: [],
  projects: [],
  bids: [],
  deals: [],
  events: [],
};

/* ------------------------------------------------------------------ */
/* Public interface                                                    */
/* ------------------------------------------------------------------ */

export function assertStorageAllowed() {
  if (DB_MODE === 'memory' && IS_PRODUCTION) {
    throw new Error(
      'DATABASE_URL is required in production — refusing to start on memory storage.'
    );
  }
}

export async function initDb() {
  if (DB_MODE === 'memory') return { mode: 'memory' };
  await query(SCHEMA);
  return { mode: 'postgres' };
}

export async function createUser({ email, passwordHash, fullName = null, phone = null }) {
  const id = crypto.randomUUID();
  if (DB_MODE === 'memory') {
    const user = {
      id,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone,
      email_verified: false,
      created_at: new Date(),
      last_login_at: null,
    };
    memory.users.set(id, user);
    memory.byEmail.set(email, id);
    return user;
  }
  const rows = await query(
    `insert into users (id, email, password_hash, full_name, phone)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [id, email, passwordHash, fullName, phone]
  );
  return rows[0];
}

export async function findUserByEmail(email) {
  if (DB_MODE === 'memory') {
    const id = memory.byEmail.get(email);
    return id ? (memory.users.get(id) ?? null) : null;
  }
  const rows = await query('select * from users where email = $1', [email]);
  return rows[0] ?? null;
}

export async function findUserById(id) {
  if (DB_MODE === 'memory') return memory.users.get(id) ?? null;
  const rows = await query('select * from users where id = $1', [id]);
  return rows[0] ?? null;
}

export async function markEmailVerified(userId) {
  if (DB_MODE === 'memory') {
    const user = memory.users.get(userId);
    if (user) user.email_verified = true;
    return;
  }
  await query('update users set email_verified = true where id = $1', [userId]);
}

export async function touchLogin(userId) {
  if (DB_MODE === 'memory') {
    const user = memory.users.get(userId);
    if (user) user.last_login_at = new Date();
    return;
  }
  await query('update users set last_login_at = now() where id = $1', [userId]);
}

/** `id` is supplied by the caller so the code digest can be keyed to it. */
export async function createCode({ id = crypto.randomUUID(), userId, codeHash, purpose, expiresAt }) {
  if (DB_MODE === 'memory') {
    const record = {
      id,
      user_id: userId,
      code_hash: codeHash,
      purpose,
      attempts: 0,
      expires_at: expiresAt,
      consumed_at: null,
      created_at: new Date(),
    };
    memory.codes.push(record);
    return record;
  }
  const rows = await query(
    `insert into email_codes (id, user_id, code_hash, purpose, expires_at)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [id, userId, codeHash, purpose, expiresAt]
  );
  return rows[0];
}

/** Most recent unconsumed code for this user and purpose. */
export async function latestCode({ userId, purpose }) {
  if (DB_MODE === 'memory') {
    const matches = memory.codes.filter(
      (record) => record.user_id === userId && record.purpose === purpose && !record.consumed_at
    );
    return matches.length ? matches[matches.length - 1] : null;
  }
  const rows = await query(
    `select * from email_codes
     where user_id = $1 and purpose = $2 and consumed_at is null
     order by created_at desc
     limit 1`,
    [userId, purpose]
  );
  return rows[0] ?? null;
}

export async function bumpAttempts(codeId) {
  if (DB_MODE === 'memory') {
    const record = memory.codes.find((entry) => entry.id === codeId);
    if (record) record.attempts += 1;
    return record?.attempts ?? 0;
  }
  const rows = await query(
    'update email_codes set attempts = attempts + 1 where id = $1 returning attempts',
    [codeId]
  );
  return rows[0]?.attempts ?? 0;
}

export async function consumeCode(codeId) {
  if (DB_MODE === 'memory') {
    const record = memory.codes.find((entry) => entry.id === codeId);
    if (record) record.consumed_at = new Date();
    return;
  }
  await query('update email_codes set consumed_at = now() where id = $1', [codeId]);
}

/** Invalidates every outstanding code of this purpose — used before issuing a new one. */
export async function invalidateCodes({ userId, purpose }) {
  if (DB_MODE === 'memory') {
    for (const record of memory.codes) {
      if (record.user_id === userId && record.purpose === purpose && !record.consumed_at) {
        record.consumed_at = new Date();
      }
    }
    return;
  }
  await query(
    'update email_codes set consumed_at = now() where user_id = $1 and purpose = $2 and consumed_at is null',
    [userId, purpose]
  );
}

export async function recordAcceptance({ userId, proposalId, totalCents, currency, lineItems }) {
  const id = crypto.randomUUID();
  const serialised = JSON.stringify(lineItems ?? []);
  if (DB_MODE === 'memory') {
    const record = {
      id,
      user_id: userId,
      proposal_id: proposalId,
      total_cents: totalCents,
      currency,
      line_items: serialised,
      accepted_at: new Date(),
    };
    memory.acceptances.push(record);
    return record;
  }
  const rows = await query(
    `insert into proposal_acceptances (id, user_id, proposal_id, total_cents, currency, line_items)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [id, userId, proposalId, totalCents, currency, serialised]
  );
  return rows[0];
}

export async function latestAcceptance({ userId, proposalId }) {
  if (DB_MODE === 'memory') {
    const matches = memory.acceptances.filter(
      (record) => record.user_id === userId && record.proposal_id === proposalId
    );
    return matches.length ? matches[matches.length - 1] : null;
  }
  const rows = await query(
    `select * from proposal_acceptances
     where user_id = $1 and proposal_id = $2
     order by accepted_at desc limit 1`,
    [userId, proposalId]
  );
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Центр проектов: исполнители, проекты, отклики, сделки               */
/* ------------------------------------------------------------------ */

const DEV_COLUMNS =
  'id, user_id, full_name, role, headline, stack, city, rate_hour, rating, projects_done, level, available, seeded';

function devFromInput(input) {
  return {
    id: input.id ?? crypto.randomUUID(),
    user_id: input.userId ?? null,
    full_name: input.fullName,
    role: input.role,
    headline: input.headline ?? null,
    stack: input.stack ?? '',
    city: input.city ?? null,
    rate_hour: Number(input.rateHour ?? 0),
    rating: Number(input.rating ?? 5),
    projects_done: Number(input.projectsDone ?? 0),
    level: input.level ?? null,
    available: input.available !== false,
    seeded: Boolean(input.seeded),
    created_at: new Date(),
  };
}

/** Идемпотентно: сид-исполнители заводятся один раз, по фиксированным id. */
export async function ensureSeedDevelopers(seeds = []) {
  if (DB_MODE === 'memory') {
    for (const seed of seeds) {
      if (memory.devs.some((dev) => dev.id === seed.id)) continue;
      memory.devs.push(devFromInput({ ...seed, seeded: true }));
    }
    return memory.devs.length;
  }
  for (const seed of seeds) {
    const dev = devFromInput({ ...seed, seeded: true });
    await query(
      `insert into dev_profiles (id, full_name, role, headline, stack, city, rate_hour, rating, projects_done, level, available, seeded)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
       on conflict (id) do nothing`,
      [
        dev.id,
        dev.full_name,
        dev.role,
        dev.headline,
        dev.stack,
        dev.city,
        dev.rate_hour,
        dev.rating,
        dev.projects_done,
        dev.level,
        dev.available,
      ]
    );
  }
  const rows = await query('select count(*)::int as count from dev_profiles');
  return rows[0]?.count ?? 0;
}

export async function listDevelopers({ role = null } = {}) {
  if (DB_MODE === 'memory') {
    return memory.devs
      .filter((dev) => (role ? dev.role === role : true))
      .sort((a, b) => Number(b.rating) - Number(a.rating));
  }
  const rows = role
    ? await query(
        `select ${DEV_COLUMNS} from dev_profiles where role = $1 order by rating desc, projects_done desc`,
        [role]
      )
    : await query(
        `select ${DEV_COLUMNS} from dev_profiles order by rating desc, projects_done desc`
      );
  return rows;
}

export async function getDeveloper(id) {
  if (DB_MODE === 'memory') return memory.devs.find((dev) => dev.id === id) ?? null;
  const rows = await query(`select ${DEV_COLUMNS} from dev_profiles where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findDeveloperByUser(userId) {
  if (DB_MODE === 'memory') return memory.devs.find((dev) => dev.user_id === userId) ?? null;
  const rows = await query(`select ${DEV_COLUMNS} from dev_profiles where user_id = $1 limit 1`, [
    userId,
  ]);
  return rows[0] ?? null;
}

export async function createDeveloper(input) {
  const dev = devFromInput(input);
  if (DB_MODE === 'memory') {
    memory.devs.push(dev);
    return dev;
  }
  const rows = await query(
    `insert into dev_profiles (id, user_id, full_name, role, headline, stack, city, rate_hour, rating, projects_done, level, available, seeded)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
     returning ${DEV_COLUMNS}`,
    [
      dev.id,
      dev.user_id,
      dev.full_name,
      dev.role,
      dev.headline,
      dev.stack,
      dev.city,
      dev.rate_hour,
      dev.rating,
      dev.projects_done,
      dev.level,
      dev.available,
    ]
  );
  return rows[0];
}

export async function createProject({
  ownerId,
  proposalId,
  title,
  summary = null,
  budget,
  currency = 'UZS',
  weeks = null,
  lineItems = [],
}) {
  const id = crypto.randomUUID();
  const serialised = JSON.stringify(lineItems ?? []);
  if (DB_MODE === 'memory') {
    const record = {
      id,
      owner_id: ownerId,
      proposal_id: proposalId,
      title,
      summary,
      budget: Number(budget),
      currency,
      weeks,
      status: 'open',
      line_items: serialised,
      created_at: new Date(),
    };
    memory.projects.push(record);
    return record;
  }
  const rows = await query(
    `insert into projects (id, owner_id, proposal_id, title, summary, budget, currency, weeks, line_items)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [id, ownerId, proposalId, title, summary, Number(budget), currency, weeks, serialised]
  );
  return rows[0];
}

export async function getProject(id) {
  if (DB_MODE === 'memory') return memory.projects.find((project) => project.id === id) ?? null;
  const rows = await query('select * from projects where id = $1', [id]);
  return rows[0] ?? null;
}

export async function listProjects({ ownerId = null } = {}) {
  if (DB_MODE === 'memory') {
    return memory.projects
      .filter((project) => (ownerId ? project.owner_id === ownerId : true))
      .slice()
      .reverse();
  }
  const rows = ownerId
    ? await query('select * from projects where owner_id = $1 order by created_at desc', [ownerId])
    : await query('select * from projects order by created_at desc limit 50');
  return rows;
}

export async function latestProjectForProposal({ ownerId, proposalId }) {
  if (DB_MODE === 'memory') {
    const matches = memory.projects.filter(
      (project) => project.owner_id === ownerId && project.proposal_id === proposalId
    );
    return matches.length ? matches[matches.length - 1] : null;
  }
  const rows = await query(
    `select * from projects where owner_id = $1 and proposal_id = $2
     order by created_at desc limit 1`,
    [ownerId, proposalId]
  );
  return rows[0] ?? null;
}

export async function setProjectStatus(id, status) {
  if (DB_MODE === 'memory') {
    const project = memory.projects.find((entry) => entry.id === id);
    if (project) project.status = status;
    return project ?? null;
  }
  const rows = await query('update projects set status = $2 where id = $1 returning *', [
    id,
    status,
  ]);
  return rows[0] ?? null;
}

export async function createBid({ projectId, devId, amount, days, message = null }) {
  const id = crypto.randomUUID();
  if (DB_MODE === 'memory') {
    const record = {
      id,
      project_id: projectId,
      dev_id: devId,
      amount: Number(amount),
      days: Number(days),
      message,
      status: 'pending',
      created_at: new Date(),
    };
    memory.bids.push(record);
    return record;
  }
  const rows = await query(
    `insert into project_bids (id, project_id, dev_id, amount, days, message)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [id, projectId, devId, Number(amount), Number(days), message]
  );
  return rows[0];
}

export async function listBids(projectId) {
  if (DB_MODE === 'memory') {
    return memory.bids.filter((bid) => bid.project_id === projectId).slice().reverse();
  }
  const rows = await query(
    'select * from project_bids where project_id = $1 order by created_at desc',
    [projectId]
  );
  return rows;
}

export async function getBid(id) {
  if (DB_MODE === 'memory') return memory.bids.find((bid) => bid.id === id) ?? null;
  const rows = await query('select * from project_bids where id = $1', [id]);
  return rows[0] ?? null;
}

export async function setBidStatus(id, status) {
  if (DB_MODE === 'memory') {
    const bid = memory.bids.find((entry) => entry.id === id);
    if (bid) bid.status = status;
    return bid ?? null;
  }
  const rows = await query('update project_bids set status = $2 where id = $1 returning *', [
    id,
    status,
  ]);
  return rows[0] ?? null;
}

export async function declineOtherBids({ projectId, keepId }) {
  if (DB_MODE === 'memory') {
    for (const bid of memory.bids) {
      if (bid.project_id === projectId && bid.id !== keepId && bid.status === 'pending') {
        bid.status = 'declined';
      }
    }
    return;
  }
  await query(
    `update project_bids set status = 'declined'
     where project_id = $1 and id <> $2 and status = 'pending'`,
    [projectId, keepId]
  );
}

export async function createDeal({ projectId, devId, amount, platformFee, payout }) {
  const id = crypto.randomUUID();
  if (DB_MODE === 'memory') {
    const record = {
      id,
      project_id: projectId,
      dev_id: devId,
      amount: Number(amount),
      platform_fee: Number(platformFee),
      payout: Number(payout),
      status: 'escrow',
      delivery_url: null,
      delivery_note: null,
      started_at: new Date(),
      submitted_at: null,
      released_at: null,
    };
    memory.deals.push(record);
    return record;
  }
  const rows = await query(
    `insert into project_deals (id, project_id, dev_id, amount, platform_fee, payout)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [id, projectId, devId, Number(amount), Number(platformFee), Number(payout)]
  );
  return rows[0];
}

export async function getDealByProject(projectId) {
  if (DB_MODE === 'memory') {
    const matches = memory.deals.filter((deal) => deal.project_id === projectId);
    return matches.length ? matches[matches.length - 1] : null;
  }
  const rows = await query(
    'select * from project_deals where project_id = $1 order by started_at desc limit 1',
    [projectId]
  );
  return rows[0] ?? null;
}

export async function getDeal(id) {
  if (DB_MODE === 'memory') return memory.deals.find((deal) => deal.id === id) ?? null;
  const rows = await query('select * from project_deals where id = $1', [id]);
  return rows[0] ?? null;
}

export async function updateDeal(id, patch = {}) {
  const allowed = ['status', 'delivery_url', 'delivery_note', 'submitted_at', 'released_at'];
  const entries = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getDeal(id);

  if (DB_MODE === 'memory') {
    const deal = memory.deals.find((entry) => entry.id === id);
    if (deal) for (const [key, value] of entries) deal[key] = value;
    return deal ?? null;
  }
  const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  const rows = await query(
    `update project_deals set ${sets} where id = $1 returning *`,
    [id, ...entries.map(([, value]) => value)]
  );
  return rows[0] ?? null;
}

export async function addEvent({ projectId, kind, message, actor = null }) {
  const id = crypto.randomUUID();
  if (DB_MODE === 'memory') {
    const record = {
      id,
      project_id: projectId,
      kind,
      message,
      actor,
      created_at: new Date(),
    };
    memory.events.push(record);
    return record;
  }
  const rows = await query(
    `insert into project_events (id, project_id, kind, message, actor)
     values ($1, $2, $3, $4, $5) returning *`,
    [id, projectId, kind, message, actor]
  );
  return rows[0];
}

export async function listEvents(projectId) {
  if (DB_MODE === 'memory') {
    return memory.events.filter((event) => event.project_id === projectId);
  }
  const rows = await query(
    'select * from project_events where project_id = $1 order by created_at asc',
    [projectId]
  );
  return rows;
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
}
