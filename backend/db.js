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
};

/* ------------------------------------------------------------------ */
/* Public interface                                                    */
/* ------------------------------------------------------------------ */

export async function initDb() {
  if (DB_MODE === 'memory') {
    if (IS_PRODUCTION) {
      throw new Error('DATABASE_URL is required in production — refusing to start on memory storage.');
    }
    return { mode: 'memory' };
  }
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

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
}
