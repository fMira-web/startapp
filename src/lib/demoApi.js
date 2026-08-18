/**
 * Demo transport.
 *
 * Enabled with VITE_DEMO_MODE=1. Every call is answered in the browser, so the
 * full journey — register, verification code, sign in, configure, accept — can
 * be explored from a single static deployment with no server, no database, and
 * no email provider.
 *
 * It mirrors the real API's shapes and error codes exactly, so `api.js` can
 * swap one for the other without any component knowing. Nothing here is a
 * security boundary: accounts live in a module-level Map and disappear on
 * reload. The real implementation is the one in `backend/`.
 */

import { SEED_DEVELOPERS, PLATFORM_FEE_RATE } from '../data/hubData';

const users = new Map(); // email -> { email, password, fullName, phone, verified }
const codes = new Map(); // email -> { code, expiresAt, attempts }
let session = null;

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

class DemoError extends Error {
  constructor(message, { status = 400, code = 'bad_input', field = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.payload = payload;
  }
}

/** Latency the eye can register, so pending states are actually visible. */
const settle = (value, ms = 550) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const WEAK = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', 'iloveyou']);

function normalise(email) {
  const value = String(email ?? '').trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : null;
}

function issueCode(email) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  codes.set(email, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
  return code;
}

function publicUser(user) {
  return {
    id: `demo-${user.email}`,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    emailVerified: user.verified,
  };
}

export async function register({ email, password, fullName, phone }) {
  const normalised = normalise(email);
  if (!normalised) {
    throw new DemoError('Введите корректный адрес почты.', { code: 'bad_email', field: 'email' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new DemoError('Пароль — минимум 8 символов.', { code: 'bad_password', field: 'password' });
  }
  if (WEAK.has(password.toLowerCase())) {
    throw new DemoError('Такой пароль слишком простой. Выберите другой.', {
      code: 'bad_password',
      field: 'password',
    });
  }

  const existing = users.get(normalised);
  if (existing?.verified) {
    throw new DemoError('На эту почту уже есть аккаунт. Войдите.', {
      status: 409,
      code: 'email_taken',
      field: 'email',
    });
  }

  users.set(normalised, {
    email: normalised,
    password,
    fullName: fullName ?? null,
    phone: phone ?? null,
    verified: false,
  });

  return settle({
    status: 'verification_sent',
    email: normalised,
    devCode: issueCode(normalised),
    resendAfterSeconds: 20,
  });
}

export async function verifyEmail({ email, code }) {
  const normalised = normalise(email);
  const record = normalised ? codes.get(normalised) : null;

  if (!record || record.expiresAt <= Date.now()) {
    throw new DemoError('Срок кода истёк. Запросите новый.', {
      status: 410,
      code: 'expired',
    });
  }

  record.attempts += 1;
  if (record.attempts > MAX_ATTEMPTS) {
    codes.delete(normalised);
    throw new DemoError('Слишком много попыток. Запросите новый код.', {
      status: 429,
      code: 'too_many_attempts',
    });
  }

  if (record.code !== code) {
    const left = MAX_ATTEMPTS - record.attempts;
    throw new DemoError(
      left > 0
        ? `Код неверный. Осталось попыток: ${left}.`
        : 'Код неверный.',
      { status: 401, code: 'invalid_code' }
    );
  }

  codes.delete(normalised);
  const user = users.get(normalised);
  user.verified = true;
  session = publicUser(user);
  return settle({ user: session });
}

export async function resendCode(email) {
  const normalised = normalise(email);
  const user = normalised ? users.get(normalised) : null;
  if (!user || user.verified) {
    return settle({ status: 'verification_sent', resendAfterSeconds: 20 });
  }
  return settle({
    status: 'verification_sent',
    devCode: issueCode(normalised),
    resendAfterSeconds: 20,
  });
}

export async function login({ email, password }) {
  const normalised = normalise(email);
  const user = normalised ? users.get(normalised) : null;

  if (!user || user.password !== password) {
    throw new DemoError('Почта или пароль неверные.', {
      status: 401,
      code: 'bad_credentials',
    });
  }

  if (!user.verified) {
    throw new DemoError('Сначала подтвердите почту — мы отправили код.', {
      status: 403,
      code: 'email_unverified',
      payload: {
        email: user.email,
        devCode: issueCode(user.email),
        resendAfterSeconds: 20,
      },
    });
  }

  session = publicUser(user);
  return settle({ user: session });
}

export async function logout() {
  session = null;
  return settle({ ok: true }, 150);
}

export async function fetchCurrentUser() {
  return settle(session, 200);
}

let acceptance = null;

export async function acceptProposal() {
  if (!session) {
    throw new DemoError('Войдите, чтобы продолжить.', { status: 401, code: 'unauthenticated' });
  }
  acceptance = { acceptedAt: new Date().toISOString() };
  return settle({ recorded: true, acceptedAt: acceptance.acceptedAt }, 700);
}

export async function fetchAcceptance() {
  return settle(acceptance, 150);
}

export async function getCapabilities() {
  return settle(
    { email: true, emailMode: 'demo', storage: 'demo', reachable: true },
    120
  );
}


/* ------------------------------------------------------------------ */
/* Центр проектов — локальная реализация                               */
/* ------------------------------------------------------------------ */


/** Форма записей повторяет ответы бэкенда (snake_case), чтобы UI не разветвлялся. */
const hub = {
  developers: SEED_DEVELOPERS.map((dev) => ({
    id: dev.id,
    user_id: null,
    full_name: dev.fullName,
    role: dev.role,
    headline: dev.headline,
    stack: dev.stack,
    city: dev.city,
    rate_hour: dev.rateHour,
    rating: dev.rating,
    projects_done: dev.projectsDone,
    level: dev.level,
    available: dev.available !== false,
  })),
  projects: [],
  bids: [],
  deals: [],
  events: [],
};

let sequence = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`;

/** Позволяет локальному режиму продолжить сессию, начатую на живом сервере. */
export function adoptSession(user) {
  if (user) session = user;
}

function devById(id) {
  return hub.developers.find((dev) => dev.id === id) ?? null;
}

function addEvent(projectId, kind, message, actor) {
  const event = {
    id: nextId('evt'),
    project_id: projectId,
    kind,
    message,
    actor,
    created_at: new Date().toISOString(),
  };
  hub.events.push(event);
  return event;
}

function requireSession() {
  if (!session) {
    throw new DemoError('Войдите, чтобы продолжить.', { status: 401, code: 'unauthenticated' });
  }
  return session;
}

function seedBids(project) {
  const offers = [
    { devId: 'dev-aziz', factor: 1.0, days: 28, message: 'Веду проект целиком. Payme и Click подключал шесть раз, оплату сдам на второй неделе.' },
    { devId: 'dev-jasur', factor: 0.92, days: 35, message: 'Готов взять со скидкой — сейчас освободился слот. Сделаю на Laravel + Vue.' },
    { devId: 'dev-sanjar', factor: 1.06, days: 24, message: 'Возьму бэкенд и интеграции, фронт закрою вместе с Диёрой. Срок сжатый, но реальный.' },
  ];
  for (const offer of offers) {
    if (!devById(offer.devId)) continue;
    hub.bids.push({
      id: nextId('bid'),
      project_id: project.id,
      dev_id: offer.devId,
      amount: Math.round(project.budget * offer.factor),
      days: offer.days,
      message: offer.message,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }
}

export async function createHubProject(input) {
  const user = requireSession();
  const existing = hub.projects.find(
    (project) => project.owner_id === user.id && project.proposal_id === input.proposalId
  );
  if (existing) return settle({ project: existing, reused: true }, 200);

  const project = {
    id: nextId('prj'),
    owner_id: user.id,
    proposal_id: input.proposalId,
    title: input.title,
    summary: input.summary ?? null,
    budget: Math.round(Number(input.budget) || 0),
    currency: input.currency ?? 'UZS',
    weeks: input.weeks ?? null,
    status: 'open',
    line_items: JSON.stringify(input.lines ?? []),
    created_at: new Date().toISOString(),
  };
  hub.projects.push(project);
  addEvent(project.id, 'created', 'Предложение принято, проект опубликован в Центре.', 'client');
  seedBids(project);
  addEvent(project.id, 'bids', 'Поступили первые отклики от исполнителей.', 'system');
  return settle({ project }, 400);
}

export async function fetchHubProjects() {
  const user = requireSession();
  return settle(
    { projects: hub.projects.filter((project) => project.owner_id === user.id).slice().reverse() },
    150
  );
}

export async function fetchHubProject(projectId) {
  const project = hub.projects.find((entry) => entry.id === projectId);
  if (!project) {
    throw new DemoError('Проект не найден.', { status: 404, code: 'not_found' });
  }
  const bids = hub.bids
    .filter((bid) => bid.project_id === projectId)
    .slice()
    .reverse()
    .map((bid) => ({ ...bid, developer: devById(bid.dev_id) }));
  const rawDeal = hub.deals.filter((deal) => deal.project_id === projectId).at(-1) ?? null;
  return settle(
    {
      project,
      bids,
      deal: rawDeal ? { ...rawDeal, developer: devById(rawDeal.dev_id) } : null,
      events: hub.events.filter((event) => event.project_id === projectId),
      developers: hub.developers,
    },
    180
  );
}

export async function fetchDevelopers(role = null) {
  const developers = role
    ? hub.developers.filter((dev) => dev.role === role)
    : hub.developers;
  return settle({ developers }, 150);
}

export async function placeBid(projectId, input) {
  const project = hub.projects.find((entry) => entry.id === projectId);
  if (!project) throw new DemoError('Проект не найден.', { status: 404, code: 'not_found' });
  if (project.status !== 'open') {
    throw new DemoError('По этому проекту уже выбран исполнитель.', { code: 'project_closed' });
  }
  const developer = devById(input.devId);
  if (!developer) throw new DemoError('Исполнитель не найден.', { code: 'dev_not_found' });

  const bid = {
    id: nextId('bid'),
    project_id: projectId,
    dev_id: developer.id,
    amount: Math.round(Number(input.amount) || 0),
    days: Math.round(Number(input.days) || 0),
    message: input.message ?? null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  hub.bids.push(bid);
  addEvent(
    projectId,
    'bid',
    `Новый отклик: ${developer.full_name} — ${bid.amount.toLocaleString('ru-RU')} сум, ${bid.days} дн.`,
    'developer'
  );
  return settle({ bid: { ...bid, developer } }, 350);
}

export async function acceptBid(projectId, bidId) {
  const project = hub.projects.find((entry) => entry.id === projectId);
  const bid = hub.bids.find((entry) => entry.id === bidId);
  if (!project || !bid) throw new DemoError('Отклик не найден.', { status: 404, code: 'not_found' });
  if (project.status !== 'open') {
    throw new DemoError('Исполнитель уже выбран.', { code: 'project_closed' });
  }

  bid.status = 'accepted';
  for (const other of hub.bids) {
    if (other.project_id === projectId && other.id !== bidId && other.status === 'pending') {
      other.status = 'declined';
    }
  }

  const platformFee = Math.round(bid.amount * PLATFORM_FEE_RATE);
  const deal = {
    id: nextId('deal'),
    project_id: projectId,
    dev_id: bid.dev_id,
    amount: bid.amount,
    platform_fee: platformFee,
    payout: bid.amount - platformFee,
    status: 'escrow',
    delivery_url: null,
    delivery_note: null,
    started_at: new Date().toISOString(),
    submitted_at: null,
    released_at: null,
  };
  hub.deals.push(deal);
  project.status = 'assigned';
  const developer = devById(bid.dev_id);
  addEvent(
    projectId,
    'assigned',
    `Проект берёт ${developer?.full_name ?? 'исполнитель'}. ${bid.amount.toLocaleString('ru-RU')} сум зарезервированы.`,
    'client'
  );
  return settle({ deal: { ...deal, developer } }, 500);
}

function currentDeal(projectId) {
  const deal = hub.deals.filter((entry) => entry.project_id === projectId).at(-1);
  if (!deal) throw new DemoError('Сделка не найдена.', { status: 404, code: 'not_found' });
  return deal;
}

export async function startWork(projectId) {
  const deal = currentDeal(projectId);
  if (deal.status !== 'escrow') throw new DemoError('Работа уже начата.', { code: 'bad_state' });
  deal.status = 'in_progress';
  const project = hub.projects.find((entry) => entry.id === projectId);
  if (project) project.status = 'in_progress';
  addEvent(projectId, 'started', 'Исполнитель приступил к работе.', 'developer');
  return settle({ deal: { ...deal, developer: devById(deal.dev_id) } }, 350);
}

export async function submitWork(projectId, input) {
  const deal = currentDeal(projectId);
  if (!['escrow', 'in_progress'].includes(deal.status)) {
    throw new DemoError('Работа уже сдана.', { code: 'bad_state' });
  }
  deal.status = 'submitted';
  deal.delivery_url = input?.url ?? null;
  deal.delivery_note = input?.note ?? null;
  deal.submitted_at = new Date().toISOString();
  const project = hub.projects.find((entry) => entry.id === projectId);
  if (project) project.status = 'submitted';
  addEvent(projectId, 'submitted', 'Исполнитель отправил работу на проверку.', 'developer');
  return settle({ deal: { ...deal, developer: devById(deal.dev_id) } }, 400);
}

export async function releasePayment(projectId) {
  const deal = currentDeal(projectId);
  if (deal.status !== 'submitted') {
    throw new DemoError('Работа ещё не сдана.', { code: 'bad_state' });
  }
  deal.status = 'released';
  deal.released_at = new Date().toISOString();
  const project = hub.projects.find((entry) => entry.id === projectId);
  if (project) project.status = 'completed';
  addEvent(
    projectId,
    'released',
    `Работа принята. ${deal.payout.toLocaleString('ru-RU')} сум переведены исполнителю.`,
    'client'
  );
  return settle({ deal: { ...deal, developer: devById(deal.dev_id) } }, 600);
}
