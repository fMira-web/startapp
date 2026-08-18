/**
 * «Центр проектов» — биржа под принятое коммерческое предложение.
 *
 * Заказчик принимает предложение -> из него создаётся проект с бюджетом.
 * Исполнители (фулстек, фронт, бэк, дизайн, QA, DevOps) откликаются,
 * заказчик выбирает отклик, сумма резервируется, исполнитель сдаёт работу,
 * заказчик подтверждает — деньги уходят исполнителю.
 */

import * as db from './db.js';
import { requireAuth } from './auth.js';

/** Комиссия площадки. Должна совпадать с PLATFORM_FEE_RATE на фронтенде. */
export const PLATFORM_FEE_RATE = 0.08;

/** Сид-исполнители: ставки в сумах за час, уровень узбекского рынка 2026. */
export const SEED_DEVELOPERS = [
  { id: 'dev-aziz', fullName: 'Азиз Тураев', role: 'fullstack', headline: 'Fullstack · React + Node.js', stack: 'React, Node.js, PostgreSQL, Payme API', city: 'Ташкент', rateHour: 140000, rating: 4.9, projectsDone: 37, level: 'Senior' },
  { id: 'dev-diyora', fullName: 'Диёра Юсупова', role: 'frontend', headline: 'Frontend · React, Next.js', stack: 'React, Next.js, Tailwind, TypeScript', city: 'Ташкент', rateHour: 110000, rating: 4.8, projectsDone: 26, level: 'Middle+' },
  { id: 'dev-sanjar', fullName: 'Санжар Каримов', role: 'backend', headline: 'Backend · NestJS, PostgreSQL', stack: 'Node.js, NestJS, PostgreSQL, Click API, 1С обмен', city: 'Самарканд', rateHour: 125000, rating: 4.9, projectsDone: 31, level: 'Senior' },
  { id: 'dev-malika', fullName: 'Малика Абдуллаева', role: 'design', headline: 'UI/UX · Figma, дизайн-системы', stack: 'Figma, дизайн-система, прототипы, мобильный UI', city: 'Ташкент', rateHour: 95000, rating: 5.0, projectsDone: 44, level: 'Senior' },
  { id: 'dev-jasur', fullName: 'Жасур Эргашев', role: 'fullstack', headline: 'Fullstack · Laravel + Vue', stack: 'Laravel, Vue, MySQL, Uzum Checkout', city: 'Наманган', rateHour: 100000, rating: 4.7, projectsDone: 19, level: 'Middle' },
  { id: 'dev-nilufar', fullName: 'Нилуфар Хакимова', role: 'qa', headline: 'QA · ручное и автотесты', stack: 'Playwright, Postman, тест-кейсы, регресс', city: 'Ташкент', rateHour: 70000, rating: 4.8, projectsDone: 52, level: 'Middle+' },
  { id: 'dev-otabek', fullName: 'Отабек Рустамов', role: 'devops', headline: 'DevOps · Docker, CI/CD', stack: 'Docker, GitHub Actions, Nginx, VPS в Ташкенте', city: 'Ташкент', rateHour: 155000, rating: 4.9, projectsDone: 23, level: 'Senior' },
  { id: 'dev-shohruh', fullName: 'Шохрух Насриддинов', role: 'fullstack', headline: 'Fullstack · Flutter + Firebase', stack: 'Flutter, Dart, Firebase, REST', city: 'Бухара', rateHour: 120000, rating: 4.6, projectsDone: 15, level: 'Middle' },
  { id: 'dev-kamola', fullName: 'Камола Исмоилова', role: 'frontend', headline: 'Frontend · Vue, Nuxt', stack: 'Vue 3, Nuxt, SCSS, доступность', city: 'Ташкент', rateHour: 85000, rating: 4.7, projectsDone: 28, level: 'Middle' },
  { id: 'dev-bekzod', fullName: 'Бекзод Юлдашев', role: 'backend', headline: 'Backend · Python, Django', stack: 'Python, Django, DRF, Celery, Eskiz SMS', city: 'Фергана', rateHour: 105000, rating: 4.8, projectsDone: 22, level: 'Middle+' },
];

const ROLE_IDS = new Set(['fullstack', 'frontend', 'backend', 'design', 'qa', 'devops']);

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function bad(res, message, code = 'bad_input') {
  return res.status(400).json({ code, message });
}

/** Автоотклики, чтобы доска не была пустой в первую секунду жизни проекта. */
async function seedBids(project) {
  const candidates = ['dev-aziz', 'dev-jasur', 'dev-sanjar'];
  const offers = [
    { devId: 'dev-aziz', factor: 1.0, days: 28, message: 'Веду проект целиком. Payme и Click подключал шесть раз, оплату сдам на второй неделе.' },
    { devId: 'dev-jasur', factor: 0.92, days: 35, message: 'Готов взять со скидкой — сейчас освободился слот. Сделаю на Laravel + Vue.' },
    { devId: 'dev-sanjar', factor: 1.06, days: 24, message: 'Возьму бэкенд и интеграции, фронт закрою вместе с Диёрой. Срок сжатый, но реальный.' },
  ];

  for (const offer of offers) {
    const dev = await db.getDeveloper(offer.devId);
    if (!dev) continue;
    if (!candidates.includes(offer.devId)) continue;
    await db.createBid({
      projectId: project.id,
      devId: offer.devId,
      amount: Math.round(toNumber(project.budget) * offer.factor),
      days: offer.days,
      message: offer.message,
    });
  }
}

export function registerHubRoutes(app) {
  /* ---------------------------------------------------------------- */
  /* Исполнители                                                       */
  /* ---------------------------------------------------------------- */

  app.get('/api/hub/developers', requireAuth, async (req, res) => {
    try {
      const role = typeof req.query?.role === 'string' && ROLE_IDS.has(req.query.role)
        ? req.query.role
        : null;
      const developers = await db.listDevelopers({ role });
      return res.json({ developers });
    } catch (error) {
      console.error('Hub developers error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить исполнителей.' });
    }
  });

  app.get('/api/hub/me/developer', requireAuth, async (req, res) => {
    try {
      const developer = await db.findDeveloperByUser(req.session.sub);
      return res.json({ developer: developer ?? null });
    } catch (error) {
      console.error('Hub own profile error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось прочитать профиль.' });
    }
  });

  app.post('/api/hub/me/developer', requireAuth, async (req, res) => {
    try {
      const { fullName, role, headline, stack, city, rateHour, level } = req.body ?? {};
      if (typeof fullName !== 'string' || fullName.trim().length < 2) {
        return bad(res, 'Укажите имя.', 'bad_name');
      }
      if (!ROLE_IDS.has(role)) return bad(res, 'Выберите специализацию.', 'bad_role');

      const existing = await db.findDeveloperByUser(req.session.sub);
      if (existing) return res.json({ developer: existing });

      const developer = await db.createDeveloper({
        userId: req.session.sub,
        fullName: fullName.trim().slice(0, 120),
        role,
        headline: typeof headline === 'string' ? headline.slice(0, 160) : null,
        stack: typeof stack === 'string' ? stack.slice(0, 400) : '',
        city: typeof city === 'string' ? city.slice(0, 80) : null,
        rateHour: Math.max(0, Math.min(2_000_000, toNumber(rateHour))),
        rating: 5,
        projectsDone: 0,
        level: typeof level === 'string' ? level.slice(0, 40) : 'Middle',
      });
      return res.status(201).json({ developer });
    } catch (error) {
      console.error('Hub create profile error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось создать профиль.' });
    }
  });

  /* ---------------------------------------------------------------- */
  /* Проекты                                                           */
  /* ---------------------------------------------------------------- */

  app.post('/api/hub/projects', requireAuth, async (req, res) => {
    try {
      const { proposalId, title, summary, budget, currency, weeks, lines } = req.body ?? {};
      if (typeof proposalId !== 'string' || !proposalId) return bad(res, 'Нет идентификатора предложения.');
      if (typeof title !== 'string' || !title.trim()) return bad(res, 'Нет названия проекта.');
      const amount = toNumber(budget);
      if (amount <= 0) return bad(res, 'Бюджет проекта должен быть больше нуля.');

      // Один проект на одно принятое предложение.
      const existing = await db.latestProjectForProposal({
        ownerId: req.session.sub,
        proposalId,
      });
      if (existing) return res.json({ project: existing, reused: true });

      const project = await db.createProject({
        ownerId: req.session.sub,
        proposalId: proposalId.slice(0, 64),
        title: title.trim().slice(0, 200),
        summary: typeof summary === 'string' ? summary.slice(0, 1000) : null,
        budget: Math.round(amount),
        currency: typeof currency === 'string' ? currency.slice(0, 8) : 'UZS',
        weeks: Number.isFinite(Number(weeks)) ? Number(weeks) : null,
        lineItems: Array.isArray(lines) ? lines.slice(0, 200) : [],
      });

      await db.addEvent({
        projectId: project.id,
        kind: 'created',
        message: 'Предложение принято, проект опубликован в Центре.',
        actor: 'client',
      });
      await seedBids(project);
      await db.addEvent({
        projectId: project.id,
        kind: 'bids',
        message: 'Поступили первые отклики от исполнителей.',
        actor: 'system',
      });

      return res.status(201).json({ project });
    } catch (error) {
      console.error('Hub create project error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось создать проект.' });
    }
  });

  app.get('/api/hub/projects', requireAuth, async (req, res) => {
    try {
      const projects = await db.listProjects({ ownerId: req.session.sub });
      return res.json({ projects });
    } catch (error) {
      console.error('Hub list projects error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить проекты.' });
    }
  });

  /** Полное состояние доски: проект, отклики с профилями, сделка, лента. */
  app.get('/api/hub/projects/:id', requireAuth, async (req, res) => {
    try {
      const project = await db.getProject(req.params.id);
      if (!project) return res.status(404).json({ code: 'not_found', message: 'Проект не найден.' });

      const [rawBids, deal, events, developers] = await Promise.all([
        db.listBids(project.id),
        db.getDealByProject(project.id),
        db.listEvents(project.id),
        db.listDevelopers({}),
      ]);

      const byId = new Map(developers.map((dev) => [dev.id, dev]));
      const bids = rawBids.map((bid) => ({ ...bid, developer: byId.get(bid.dev_id) ?? null }));

      return res.json({
        project,
        bids,
        deal: deal ? { ...deal, developer: byId.get(deal.dev_id) ?? null } : null,
        events,
        developers,
      });
    } catch (error) {
      console.error('Hub project error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить проект.' });
    }
  });

  /* ---------------------------------------------------------------- */
  /* Отклики и сделка                                                  */
  /* ---------------------------------------------------------------- */

  /** Исполнитель откликается на проект. */
  app.post('/api/hub/projects/:id/bids', requireAuth, async (req, res) => {
    try {
      const project = await db.getProject(req.params.id);
      if (!project) return res.status(404).json({ code: 'not_found', message: 'Проект не найден.' });
      if (project.status !== 'open') {
        return bad(res, 'По этому проекту уже выбран исполнитель.', 'project_closed');
      }

      const { devId, amount, days, message } = req.body ?? {};
      const developer = await db.getDeveloper(String(devId ?? ''));
      if (!developer) return bad(res, 'Исполнитель не найден.', 'dev_not_found');

      const value = Math.round(toNumber(amount));
      if (value <= 0) return bad(res, 'Укажите сумму отклика.');
      const term = Math.round(toNumber(days));
      if (term <= 0) return bad(res, 'Укажите срок в днях.');

      const bid = await db.createBid({
        projectId: project.id,
        devId: developer.id,
        amount: value,
        days: term,
        message: typeof message === 'string' ? message.slice(0, 600) : null,
      });
      await db.addEvent({
        projectId: project.id,
        kind: 'bid',
        message: `Новый отклик: ${developer.full_name} — ${value.toLocaleString('ru-RU')} сум, ${term} дн.`,
        actor: 'developer',
      });

      return res.status(201).json({ bid: { ...bid, developer } });
    } catch (error) {
      console.error('Hub bid error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось отправить отклик.' });
    }
  });

  /** Заказчик принимает отклик — сумма уходит в резерв. */
  app.post('/api/hub/projects/:id/bids/:bidId/accept', requireAuth, async (req, res) => {
    try {
      const project = await db.getProject(req.params.id);
      if (!project) return res.status(404).json({ code: 'not_found', message: 'Проект не найден.' });
      if (project.owner_id !== req.session.sub) {
        return res.status(403).json({ code: 'forbidden', message: 'Только заказчик выбирает исполнителя.' });
      }
      if (project.status !== 'open') {
        return bad(res, 'Исполнитель уже выбран.', 'project_closed');
      }

      const bid = await db.getBid(req.params.bidId);
      if (!bid || bid.project_id !== project.id) {
        return res.status(404).json({ code: 'not_found', message: 'Отклик не найден.' });
      }

      const developer = await db.getDeveloper(bid.dev_id);
      const amount = toNumber(bid.amount);
      const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
      const payout = amount - platformFee;

      await db.setBidStatus(bid.id, 'accepted');
      await db.declineOtherBids({ projectId: project.id, keepId: bid.id });
      const deal = await db.createDeal({
        projectId: project.id,
        devId: bid.dev_id,
        amount,
        platformFee,
        payout,
      });
      await db.setProjectStatus(project.id, 'assigned');
      await db.addEvent({
        projectId: project.id,
        kind: 'assigned',
        message: `Проект берёт ${developer?.full_name ?? 'исполнитель'}. ${amount.toLocaleString('ru-RU')} сум зарезервированы.`,
        actor: 'client',
      });

      return res.json({ deal: { ...deal, developer: developer ?? null } });
    } catch (error) {
      console.error('Hub accept bid error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось принять отклик.' });
    }
  });

  /** Исполнитель начинает работу. */
  app.post('/api/hub/projects/:id/start', requireAuth, async (req, res) => {
    try {
      const deal = await db.getDealByProject(req.params.id);
      if (!deal) return res.status(404).json({ code: 'not_found', message: 'Сделка не найдена.' });
      if (deal.status !== 'escrow') return bad(res, 'Работа уже начата.', 'bad_state');

      const updated = await db.updateDeal(deal.id, { status: 'in_progress' });
      await db.setProjectStatus(req.params.id, 'in_progress');
      await db.addEvent({
        projectId: req.params.id,
        kind: 'started',
        message: 'Исполнитель приступил к работе.',
        actor: 'developer',
      });
      return res.json({ deal: updated });
    } catch (error) {
      console.error('Hub start error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось начать работу.' });
    }
  });

  /** Исполнитель сдаёт работу. */
  app.post('/api/hub/projects/:id/submit', requireAuth, async (req, res) => {
    try {
      const deal = await db.getDealByProject(req.params.id);
      if (!deal) return res.status(404).json({ code: 'not_found', message: 'Сделка не найдена.' });
      if (!['escrow', 'in_progress'].includes(deal.status)) {
        return bad(res, 'Работа уже сдана.', 'bad_state');
      }

      const { url, note } = req.body ?? {};
      const updated = await db.updateDeal(deal.id, {
        status: 'submitted',
        delivery_url: typeof url === 'string' ? url.slice(0, 500) : null,
        delivery_note: typeof note === 'string' ? note.slice(0, 1000) : null,
        submitted_at: new Date().toISOString(),
      });
      await db.setProjectStatus(req.params.id, 'submitted');
      await db.addEvent({
        projectId: req.params.id,
        kind: 'submitted',
        message: 'Исполнитель отправил работу на проверку.',
        actor: 'developer',
      });
      return res.json({ deal: updated });
    } catch (error) {
      console.error('Hub submit error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось сдать работу.' });
    }
  });

  /** Заказчик принимает работу — деньги уходят исполнителю. */
  app.post('/api/hub/projects/:id/release', requireAuth, async (req, res) => {
    try {
      const project = await db.getProject(req.params.id);
      if (!project) return res.status(404).json({ code: 'not_found', message: 'Проект не найден.' });
      if (project.owner_id !== req.session.sub) {
        return res.status(403).json({ code: 'forbidden', message: 'Оплату подтверждает заказчик.' });
      }

      const deal = await db.getDealByProject(project.id);
      if (!deal) return res.status(404).json({ code: 'not_found', message: 'Сделка не найдена.' });
      if (deal.status !== 'submitted') {
        return bad(res, 'Работа ещё не сдана.', 'bad_state');
      }

      const updated = await db.updateDeal(deal.id, {
        status: 'released',
        released_at: new Date().toISOString(),
      });
      await db.setProjectStatus(project.id, 'completed');
      const developer = await db.getDeveloper(deal.dev_id);
      await db.addEvent({
        projectId: project.id,
        kind: 'released',
        message: `Работа принята. ${toNumber(deal.payout).toLocaleString('ru-RU')} сум переведены исполнителю.`,
        actor: 'client',
      });
      return res.json({ deal: { ...updated, developer: developer ?? null } });
    } catch (error) {
      console.error('Hub release error:', error);
      return res.status(500).json({ code: 'server_error', message: 'Не удалось провести оплату.' });
    }
  });
}

export default registerHubRoutes;
