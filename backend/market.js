/**
 * REST-слой биржи фриланса.
 *
 * Один принцип на весь файл: право на действие проверяется по записи в базе,
 * а не по тому, что прислал клиент. Автор проекта определяется по owner_id,
 * администратор — по users.is_admin, роль — по users.role. Интерфейс может
 * скрывать кнопки как угодно; сервер всё равно перепроверяет.
 */

import * as db from './db.js';
import * as market from './market-db.js';
import * as offers from './offers.js';
import { attachUser, requireUser, requireRole } from './auth.js';

/** Комиссия площадки — используется при расчёте выплаты исполнителю. */
export const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE ?? 0.08);

/* ------------------------------------------------------------------ */
/* Вспомогательное                                                     */
/* ------------------------------------------------------------------ */

function bad(res, message, code = 'bad_input') {
  return res.status(400).json({ code, message });
}

function notFound(res, message = 'Не найдено.') {
  return res.status(404).json({ code: 'not_found', message });
}

function forbidden(res, message = 'Недостаточно прав.') {
  return res.status(403).json({ code: 'forbidden', message });
}

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

const isAdmin = (user) => user?.is_admin === true;

/** Изменять и удалять проект может только его автор или администратор. */
function canManageProject(user, project) {
  if (!user || !project) return false;
  return project.owner_id === user.id || isAdmin(user);
}

/** Публичная карточка пользователя — то, что безопасно показывать всем. */
function userCard(user, profile = null) {
  if (!user) return null;
  const card = {
    id: user.id,
    fullName: user.full_name ?? null,
    role: user.role ?? 'client',
    avatarUrl: user.avatar_url ?? null,
    isAdmin: user.is_admin === true,
    createdAt: user.created_at ?? null,
  };
  if (!profile) return card;

  if ((user.role ?? 'client') === 'developer') {
    return {
      ...card,
      sphere: profile.sphere,
      level: profile.level,
      stack: profile.stack,
      headline: profile.headline,
      city: profile.city,
      rateHour: Number(profile.rate_hour ?? 0),
      currency: profile.currency ?? 'UZS',
      available: profile.available !== false,
      rating: Number(profile.rating ?? 0),
      reviewsCount: Number(profile.reviews_count ?? 0),
      projectsDone: Number(profile.projects_done ?? 0),
    };
  }
  return {
    ...card,
    company: profile.company,
    city: profile.city,
    site: profile.site,
    rating: Number(profile.rating ?? 0),
    reviewsCount: Number(profile.reviews_count ?? 0),
    projectsPosted: Number(profile.projects_posted ?? 0),
  };
}

/** Проект в форме, удобной фронтенду: теги распакованы, суммы — числа. */
function shapeProject(project, extra = {}) {
  if (!project) return null;
  return {
    id: project.id,
    ownerId: project.owner_id,
    title: project.title,
    description: project.description ?? '',
    category: project.category,
    tags: market.parseJson(project.tags, []),
    budgetMin: Number(project.budget_min ?? 0),
    budgetMax: Number(project.budget_max ?? 0),
    currency: project.currency ?? 'UZS',
    deadlineDays: project.deadline_days ?? null,
    level: project.level ?? null,
    status: project.status,
    moderation: project.moderation,
    moderationNote: project.moderation_note ?? null,
    assigneeId: project.assignee_id ?? null,
    agreedAmount: project.agreed_amount == null ? null : Number(project.agreed_amount),
    bidsCount: Number(project.bids_count ?? 0),
    views: Number(project.views ?? 0),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    startedAt: project.started_at ?? null,
    completedAt: project.completed_at ?? null,
    ...extra,
  };
}

function shapeBid(bid, developer = null) {
  return {
    id: bid.id,
    projectId: bid.project_id,
    devId: bid.dev_id,
    amount: Number(bid.amount),
    days: Number(bid.days),
    message: bid.message ?? null,
    status: bid.status,
    createdAt: bid.created_at,
    developer,
  };
}

/** Подмешивает авторов к списку строк за один проход по базе. */
async function hydrateUsers(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const user = await db.findUserById(id);
      if (!user) return [id, null];
      const profile =
        (user.role ?? 'client') === 'developer'
          ? await market.getDevProfile(id)
          : await market.getClientProfile(id);
      return [id, userCard(user, profile)];
    })
  );
  return new Map(entries);
}

/** Читать переписку могут заказчик, назначенный исполнитель, откликнувшиеся и админ. */
async function canSeeThread(user, project) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (project.owner_id === user.id) return true;
  if (project.assignee_id === user.id) return true;
  const bids = await market.listBids(project.id);
  return bids.some((bid) => bid.dev_id === user.id);
}

/* ------------------------------------------------------------------ */
/* Маршруты                                                            */
/* ------------------------------------------------------------------ */

export function registerMarketRoutes(app) {
  /* ================================================================ */
  /* Справочники                                                       */
  /* ================================================================ */

  app.get('/api/market/meta', async (_req, res) => {
    res.json({
      spheres: market.SPHERES,
      levels: market.LEVELS,
      categories: market.CATEGORIES,
      statuses: market.PROJECT_STATUSES,
      rotationDays: offers.ROTATION_DAYS,
      platformFeeRate: PLATFORM_FEE_RATE,
    });
  });

  app.get('/api/market/tags', async (_req, res) => {
    try {
      res.json({ tags: await market.popularTags(30) });
    } catch (error) {
      console.error('tags error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось собрать теги.' });
    }
  });

  /* ================================================================ */
  /* Динамические предложения главной                                  */
  /* ================================================================ */

  /** Подборка текущего окна. Обновляется сама раз в OFFER_ROTATION_DAYS суток. */
  app.get('/api/market/offers', async (_req, res) => {
    try {
      const current = await offers.currentOffers();
      res.json({
        ...current,
        nextRotationAt: current.endsAt,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('offers error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить предложения.' });
    }
  });

  /** «История изменений / Прошедшие акции». */
  app.get('/api/market/offers/history', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(60, toInt(req.query?.limit, 20)));
      res.json({ windows: await offers.offersHistory({ limit }) });
    } catch (error) {
      console.error('offers history error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить историю.' });
    }
  });

  /* ================================================================ */
  /* Доска проектов                                                    */
  /* ================================================================ */

  /**
   * Витрина. Открыта без входа: гость должен видеть, ради чего регистрируется.
   * Скрытые модерацией проекты в выдачу не попадают никогда.
   */
  app.get('/api/market/projects', attachUser, async (req, res) => {
    try {
      const query = req.query ?? {};
      const tags = String(query.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const { projects, total } = await market.listProjects({
        search: String(query.search ?? ''),
        category: market.CATEGORY_IDS.has(query.category) ? query.category : null,
        status: market.STATUS_IDS.has(query.status) ? query.status : null,
        level: market.LEVEL_IDS.has(query.level) ? query.level : null,
        tags,
        budgetMin: toInt(query.budgetMin, null),
        budgetMax: toInt(query.budgetMax, null),
        ownerId: typeof query.ownerId === 'string' && query.ownerId ? query.ownerId : null,
        sort: ['fresh', 'budget', 'bids'].includes(query.sort) ? query.sort : 'fresh',
        limit: Math.max(1, Math.min(60, toInt(query.limit, 24))),
        offset: Math.max(0, toInt(query.offset, 0)),
      });

      const owners = await hydrateUsers(projects.map((project) => project.owner_id));
      res.json({
        total,
        projects: projects.map((project) =>
          shapeProject(project, { owner: owners.get(project.owner_id) ?? null })
        ),
      });
    } catch (error) {
      console.error('projects list error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить проекты.' });
    }
  });

  /** Публикация проекта. Только заказчик — у программиста этой кнопки нет. */
  app.post('/api/market/projects', requireUser, requireRole('client'), async (req, res) => {
    try {
      const body = req.body ?? {};
      const title = text(body.title, 160);
      if (!title || title.length < 6) return bad(res, 'Название — минимум 6 символов.', 'bad_title');

      const description = text(body.description, 8000);
      if (!description || description.length < 20) {
        return bad(res, 'Опишите задачу подробнее — минимум 20 символов.', 'bad_description');
      }

      const category = market.CATEGORY_IDS.has(body.category) ? body.category : 'other';
      const budgetMin = Math.max(0, toInt(body.budgetMin, 0) ?? 0);
      const budgetMax = Math.max(0, toInt(body.budgetMax, 0) ?? 0);
      if (budgetMax <= 0) return bad(res, 'Укажите верхнюю границу бюджета.', 'bad_budget');
      if (budgetMin > budgetMax) return bad(res, 'Нижняя граница бюджета больше верхней.', 'bad_budget');

      const project = await market.createProject({
        ownerId: req.user.id,
        title,
        description,
        category,
        tags: body.tags,
        budgetMin,
        budgetMax,
        currency: text(body.currency, 8) ?? 'UZS',
        deadlineDays: toInt(body.deadlineDays, null),
        level: market.LEVEL_IDS.has(body.level) ? body.level : null,
      });

      await market.addEvent({
        projectId: project.id,
        kind: 'created',
        message: 'Проект опубликован и открыт для откликов.',
        actorId: req.user.id,
      });
      await market.bumpCounter(req.user.id, 'client', 'projects_posted');

      res.status(201).json({ project: shapeProject(project) });
    } catch (error) {
      console.error('project create error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось опубликовать проект.' });
    }
  });

  /** Карточка проекта. Отклики видят заказчик, админ и сам откликнувшийся. */
  app.get('/api/market/projects/:id', attachUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');

      const viewer = req.user ?? null;
      if (project.moderation !== 'published' && !canManageProject(viewer, project)) {
        return notFound(res, 'Проект не найден.');
      }

      const [rawBids, events, reviews] = await Promise.all([
        market.listBids(project.id),
        market.listEvents(project.id),
        market.listReviewsForProject(project.id),
      ]);

      const owner = (await hydrateUsers([project.owner_id])).get(project.owner_id) ?? null;
      const devs = await hydrateUsers(rawBids.map((bid) => bid.dev_id).concat(project.assignee_id));

      const manages = canManageProject(viewer, project);
      const visibleBids = rawBids.filter(
        (bid) => manages || (viewer && bid.dev_id === viewer.id)
      );

      if (!viewer || viewer.id !== project.owner_id) await market.bumpProjectViews(project.id);

      res.json({
        project: shapeProject(project, {
          owner,
          assignee: project.assignee_id ? (devs.get(project.assignee_id) ?? null) : null,
        }),
        bids: visibleBids.map((bid) => shapeBid(bid, devs.get(bid.dev_id) ?? null)),
        bidsHidden: rawBids.length - visibleBids.length,
        events,
        reviews: reviews.map((review) => ({
          id: review.id,
          authorId: review.author_id,
          targetId: review.target_id,
          rating: Number(review.rating),
          comment: review.comment,
          createdAt: review.created_at,
        })),
        permissions: {
          canEdit: manages,
          canDelete: manages,
          canBid:
            Boolean(viewer) &&
            viewer.role === 'developer' &&
            project.status === 'open' &&
            project.moderation === 'published',
          canModerate: isAdmin(viewer),
        },
      });
    } catch (error) {
      console.error('project read error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить проект.' });
    }
  });

  /**
   * Правка проекта. Здесь и живёт требование «только автор или админ»:
   * любой другой аккаунт получает 403 независимо от того, что он прислал.
   */
  app.patch('/api/market/projects/:id', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!canManageProject(req.user, project)) {
        return forbidden(res, 'Редактировать проект может только его автор или администратор.');
      }
      if (project.status === 'completed' && !isAdmin(req.user)) {
        return bad(res, 'Завершённый проект уже нельзя редактировать.', 'project_closed');
      }

      const body = req.body ?? {};
      const patch = {};

      if (body.title !== undefined) {
        const title = text(body.title, 160);
        if (!title || title.length < 6) return bad(res, 'Название — минимум 6 символов.', 'bad_title');
        patch.title = title;
      }
      if (body.description !== undefined) {
        const description = text(body.description, 8000);
        if (!description || description.length < 20) {
          return bad(res, 'Описание — минимум 20 символов.', 'bad_description');
        }
        patch.description = description;
      }
      if (body.category !== undefined) {
        if (!market.CATEGORY_IDS.has(body.category)) return bad(res, 'Неизвестная категория.', 'bad_category');
        patch.category = body.category;
      }
      if (body.tags !== undefined) patch.tags = JSON.stringify(market.normaliseTags(body.tags));
      if (body.level !== undefined) {
        patch.level = market.LEVEL_IDS.has(body.level) ? body.level : null;
      }
      if (body.deadlineDays !== undefined) patch.deadline_days = toInt(body.deadlineDays, null);
      if (body.budgetMin !== undefined || body.budgetMax !== undefined) {
        const budgetMin = Math.max(0, toInt(body.budgetMin, Number(project.budget_min)) ?? 0);
        const budgetMax = Math.max(0, toInt(body.budgetMax, Number(project.budget_max)) ?? 0);
        if (budgetMax <= 0) return bad(res, 'Укажите верхнюю границу бюджета.', 'bad_budget');
        if (budgetMin > budgetMax) return bad(res, 'Нижняя граница бюджета больше верхней.', 'bad_budget');
        patch.budget_min = budgetMin;
        patch.budget_max = budgetMax;
      }

      const updated = await market.updateProject(project.id, patch);
      await market.addEvent({
        projectId: project.id,
        kind: 'updated',
        message: isAdmin(req.user) && project.owner_id !== req.user.id
          ? 'Проект отредактирован администратором.'
          : 'Заказчик обновил условия проекта.',
        actorId: req.user.id,
      });

      res.json({ project: shapeProject(updated) });
    } catch (error) {
      console.error('project update error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось сохранить проект.' });
    }
  });

  app.delete('/api/market/projects/:id', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!canManageProject(req.user, project)) {
        return forbidden(res, 'Удалить проект может только его автор или администратор.');
      }
      if (project.status === 'in_progress' && !isAdmin(req.user)) {
        return bad(res, 'Проект уже в работе — сначала отмените или завершите его.', 'project_busy');
      }
      await market.deleteProject(project.id);
      res.json({ deleted: true });
    } catch (error) {
      console.error('project delete error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось удалить проект.' });
    }
  });

  /** Ручная смена статуса заказа: В поиске → В работе → Завершён. */
  app.post('/api/market/projects/:id/status', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!canManageProject(req.user, project)) {
        return forbidden(res, 'Статус меняет автор проекта или администратор.');
      }

      const next = req.body?.status;
      if (!market.STATUS_IDS.has(next)) return bad(res, 'Неизвестный статус.', 'bad_status');

      const allowed = {
        open: ['in_progress', 'cancelled'],
        in_progress: ['completed', 'cancelled', 'open'],
        completed: [],
        cancelled: ['open'],
      };
      if (!isAdmin(req.user) && !allowed[project.status].includes(next)) {
        return bad(res, `Из статуса «${project.status}» нельзя перейти в «${next}».`, 'bad_transition');
      }
      if (next === 'in_progress' && !project.assignee_id) {
        return bad(res, 'Сначала выберите исполнителя из откликов.', 'no_assignee');
      }

      const patch = { status: next };
      if (next === 'in_progress') patch.started_at = new Date().toISOString();
      if (next === 'completed') patch.completed_at = new Date().toISOString();
      if (next === 'open') {
        patch.assignee_id = null;
        patch.agreed_amount = null;
      }

      const updated = await market.updateProject(project.id, patch);

      if (next === 'completed' && project.assignee_id) {
        await market.bumpCounter(project.assignee_id, 'developer', 'projects_done');
      }

      const labels = {
        open: 'Проект снова в поиске исполнителя.',
        in_progress: 'Проект переведён в работу.',
        completed: 'Работа принята, проект завершён.',
        cancelled: 'Проект отменён.',
      };
      await market.addEvent({
        projectId: project.id,
        kind: `status:${next}`,
        message: labels[next],
        actorId: req.user.id,
      });

      res.json({ project: shapeProject(updated) });
    } catch (error) {
      console.error('project status error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось изменить статус.' });
    }
  });

  /* ================================================================ */
  /* Отклики                                                           */
  /* ================================================================ */

  app.post('/api/market/projects/:id/bids', requireUser, requireRole('developer'), async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (project.moderation !== 'published') return bad(res, 'Проект снят с публикации.', 'project_hidden');
      if (project.status !== 'open') return bad(res, 'По проекту уже выбран исполнитель.', 'project_closed');
      if (project.owner_id === req.user.id) return bad(res, 'Нельзя откликнуться на свой проект.', 'own_project');

      const amount = toInt(req.body?.amount, 0);
      const days = toInt(req.body?.days, 0);
      if (!amount || amount <= 0) return bad(res, 'Укажите сумму отклика.', 'bad_amount');
      if (!days || days <= 0) return bad(res, 'Укажите срок в днях.', 'bad_days');

      const bid = await market.createBid({
        projectId: project.id,
        devId: req.user.id,
        amount,
        days,
        message: text(req.body?.message, 2000),
      });

      const count = await market.countBids(project.id);
      await market.updateProject(project.id, { bids_count: count });
      await market.addEvent({
        projectId: project.id,
        kind: 'bid',
        message: `Новый отклик: ${amount.toLocaleString('ru-RU')} ${project.currency}, ${days} дн.`,
        actorId: req.user.id,
      });

      const devs = await hydrateUsers([req.user.id]);
      res.status(201).json({ bid: shapeBid(bid, devs.get(req.user.id) ?? null) });
    } catch (error) {
      console.error('bid error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось отправить отклик.' });
    }
  });

  app.delete('/api/market/projects/:id/bids/:bidId', requireUser, async (req, res) => {
    try {
      const bid = await market.getBid(req.params.bidId);
      if (!bid || bid.project_id !== req.params.id) return notFound(res, 'Отклик не найден.');
      if (bid.dev_id !== req.user.id && !isAdmin(req.user)) {
        return forbidden(res, 'Отозвать отклик может только его автор.');
      }
      if (bid.status === 'accepted') return bad(res, 'Принятый отклик отозвать нельзя.', 'bid_accepted');

      await market.deleteBid(bid.id);
      const count = await market.countBids(bid.project_id);
      await market.updateProject(bid.project_id, { bids_count: count });
      res.json({ deleted: true });
    } catch (error) {
      console.error('bid delete error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось отозвать отклик.' });
    }
  });

  /** Заказчик выбирает исполнителя: проект уходит «В работу». */
  app.post('/api/market/projects/:id/bids/:bidId/accept', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!canManageProject(req.user, project)) {
        return forbidden(res, 'Исполнителя выбирает заказчик или администратор.');
      }
      if (project.status !== 'open') return bad(res, 'Исполнитель уже выбран.', 'project_closed');

      const bid = await market.getBid(req.params.bidId);
      if (!bid || bid.project_id !== project.id) return notFound(res, 'Отклик не найден.');

      await market.setBidStatus(bid.id, 'accepted');
      await market.declineOtherBids(project.id, bid.id);

      const updated = await market.updateProject(project.id, {
        status: 'in_progress',
        assignee_id: bid.dev_id,
        agreed_amount: Number(bid.amount),
        started_at: new Date().toISOString(),
      });

      const devs = await hydrateUsers([bid.dev_id]);
      const developer = devs.get(bid.dev_id) ?? null;
      await market.addEvent({
        projectId: project.id,
        kind: 'assigned',
        message: `Исполнитель выбран: ${developer?.fullName ?? 'участник площадки'}. Сумма — ${Number(
          bid.amount
        ).toLocaleString('ru-RU')} ${project.currency}.`,
        actorId: req.user.id,
      });

      res.json({
        project: shapeProject(updated, { assignee: developer }),
        bid: shapeBid({ ...bid, status: 'accepted' }, developer),
        payout: {
          amount: Number(bid.amount),
          platformFee: Math.round(Number(bid.amount) * PLATFORM_FEE_RATE),
          developerGets: Number(bid.amount) - Math.round(Number(bid.amount) * PLATFORM_FEE_RATE),
        },
      });
    } catch (error) {
      console.error('bid accept error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось принять отклик.' });
    }
  });

  /* ================================================================ */
  /* Переписка по проекту                                              */
  /* ================================================================ */

  app.get('/api/market/projects/:id/messages', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!(await canSeeThread(req.user, project))) {
        return forbidden(res, 'Переписка доступна участникам проекта.');
      }
      const rows = await market.listMessages(project.id);
      const authors = await hydrateUsers(rows.map((row) => row.author_id));
      res.json({
        messages: rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          authorId: row.author_id,
          author: authors.get(row.author_id) ?? null,
          body: row.body,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      console.error('messages error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить переписку.' });
    }
  });

  app.post('/api/market/projects/:id/messages', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (!(await canSeeThread(req.user, project))) {
        return forbidden(res, 'Писать в проект могут его участники.');
      }
      const body = text(req.body?.body, 4000);
      if (!body) return bad(res, 'Сообщение пустое.', 'empty_message');

      const message = await market.addMessage({
        projectId: project.id,
        authorId: req.user.id,
        body,
      });
      const authors = await hydrateUsers([req.user.id]);
      res.status(201).json({
        message: {
          id: message.id,
          projectId: message.project_id,
          authorId: message.author_id,
          author: authors.get(req.user.id) ?? null,
          body: message.body,
          createdAt: message.created_at,
        },
      });
    } catch (error) {
      console.error('message send error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось отправить сообщение.' });
    }
  });

  /* ================================================================ */
  /* Отзывы                                                            */
  /* ================================================================ */

  app.post('/api/market/projects/:id/reviews', requireUser, async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      if (project.status !== 'completed') {
        return bad(res, 'Отзыв можно оставить после завершения проекта.', 'not_completed');
      }
      const isOwnerSide = project.owner_id === req.user.id;
      const isDevSide = project.assignee_id === req.user.id;
      if (!isOwnerSide && !isDevSide) return forbidden(res, 'Отзыв оставляют участники сделки.');

      const targetId = isOwnerSide ? project.assignee_id : project.owner_id;
      if (!targetId) return bad(res, 'Второй участник сделки не найден.', 'no_target');

      const rating = toInt(req.body?.rating, 0);
      if (!rating || rating < 1 || rating > 5) return bad(res, 'Оценка — от 1 до 5.', 'bad_rating');

      await market.addReview({
        projectId: project.id,
        authorId: req.user.id,
        targetId,
        rating,
        comment: text(req.body?.comment, 2000),
      });

      const target = await db.findUserById(targetId);
      const stats = await market.recomputeRating(targetId, target?.role ?? 'developer');
      await market.addEvent({
        projectId: project.id,
        kind: 'review',
        message: `Оставлен отзыв: ${rating} из 5.`,
        actorId: req.user.id,
      });

      res.status(201).json({ rating: stats.rating, reviewsCount: stats.reviewsCount });
    } catch (error) {
      console.error('review error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось сохранить отзыв.' });
    }
  });

  app.get('/api/market/users/:id/reviews', async (req, res) => {
    try {
      const rows = await market.listReviewsFor(req.params.id, 50);
      const authors = await hydrateUsers(rows.map((row) => row.author_id));
      res.json({
        reviews: rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          rating: Number(row.rating),
          comment: row.comment,
          createdAt: row.created_at,
          author: authors.get(row.author_id) ?? null,
        })),
      });
    } catch (error) {
      console.error('reviews error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить отзывы.' });
    }
  });

  /* ================================================================ */
  /* Профили и каталог исполнителей                                    */
  /* ================================================================ */

  app.get('/api/market/developers', async (req, res) => {
    try {
      const query = req.query ?? {};
      const { profiles, total } = await market.listDevProfiles({
        sphere: market.SPHERE_IDS.has(query.sphere) ? query.sphere : null,
        level: market.LEVEL_IDS.has(query.level) ? query.level : null,
        search: String(query.search ?? ''),
        available: query.available === 'true' ? true : query.available === 'false' ? false : null,
        limit: Math.max(1, Math.min(60, toInt(query.limit, 24))),
        offset: Math.max(0, toInt(query.offset, 0)),
      });

      const users = await Promise.all(profiles.map((profile) => db.findUserById(profile.user_id)));
      const developers = profiles
        .map((profile, index) => {
          const user = users[index];
          if (!user || user.is_blocked === true) return null;
          return userCard(user, profile);
        })
        .filter(Boolean);

      res.json({ developers, total });
    } catch (error) {
      console.error('developers error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить исполнителей.' });
    }
  });

  /** Публичная страница профиля: кто это, что умеет, что уже сделал. */
  app.get('/api/market/users/:id', async (req, res) => {
    try {
      const user = await db.findUserById(req.params.id);
      if (!user || user.is_blocked === true) return notFound(res, 'Профиль не найден.');

      const role = user.role ?? 'client';
      const profile =
        role === 'developer'
          ? await market.getDevProfile(user.id)
          : await market.getClientProfile(user.id);

      const own =
        role === 'client'
          ? await market.listProjects({ ownerId: user.id, limit: 20 })
          : await market.listProjects({ assigneeId: user.id, limit: 20 });

      const reviews = await market.listReviewsFor(user.id, 20);
      const authors = await hydrateUsers(reviews.map((review) => review.author_id));

      res.json({
        user: userCard(user, profile),
        profile:
          role === 'developer' && profile
            ? {
                bio: profile.bio ?? null,
                portfolio: market.parseJson(profile.portfolio, []),
                links: market.parseJson(profile.links, {}),
              }
            : { about: profile?.about ?? null },
        projects: own.projects.map((project) => shapeProject(project)),
        reviews: reviews.map((review) => ({
          id: review.id,
          projectId: review.project_id,
          rating: Number(review.rating),
          comment: review.comment,
          createdAt: review.created_at,
          author: authors.get(review.author_id) ?? null,
        })),
      });
    } catch (error) {
      console.error('profile error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить профиль.' });
    }
  });

  /** Личный кабинет: профиль, свои проекты, свои отклики. */
  app.get('/api/market/me', requireUser, async (req, res) => {
    try {
      const role = req.user.role ?? 'client';
      const profile =
        role === 'developer'
          ? await market.getDevProfile(req.user.id)
          : await market.getClientProfile(req.user.id);

      const mine =
        role === 'client'
          ? await market.listProjects({ ownerId: req.user.id, includeHidden: true, limit: 60 })
          : await market.listProjects({ assigneeId: req.user.id, includeHidden: true, limit: 60 });

      const bids = role === 'developer' ? await market.listBidsByDev(req.user.id) : [];
      const bidProjects = await Promise.all(bids.map((bid) => market.getProject(bid.project_id)));

      res.json({
        user: userCard(req.user, profile),
        profile:
          role === 'developer'
            ? {
                sphere: profile?.sphere ?? null,
                level: profile?.level ?? null,
                stack: profile?.stack ?? '',
                headline: profile?.headline ?? null,
                bio: profile?.bio ?? null,
                city: profile?.city ?? null,
                rateHour: Number(profile?.rate_hour ?? 0),
                available: profile?.available !== false,
                portfolio: market.parseJson(profile?.portfolio, []),
                links: market.parseJson(profile?.links, {}),
              }
            : {
                company: profile?.company ?? null,
                about: profile?.about ?? null,
                city: profile?.city ?? null,
                site: profile?.site ?? null,
              },
        projects: mine.projects.map((project) => shapeProject(project)),
        bids: bids.map((bid, index) => ({
          ...shapeBid(bid),
          project: bidProjects[index] ? shapeProject(bidProjects[index]) : null,
        })),
      });
    } catch (error) {
      console.error('me error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить кабинет.' });
    }
  });

  /**
   * Правка своего профиля. Роль в тело запроса не принимается вовсе —
   * какие поля можно менять, решает роль из базы.
   */
  app.patch('/api/market/me/profile', requireUser, async (req, res) => {
    try {
      const body = req.body ?? {};
      const role = req.user.role ?? 'client';

      if (body.role !== undefined || body.isAdmin !== undefined) {
        return forbidden(res, 'Роль и права аккаунта через этот маршрут не меняются.');
      }

      const nameFields = {};
      if (body.fullName !== undefined) nameFields.full_name = text(body.fullName, 120);
      if (body.avatarUrl !== undefined) nameFields.avatar_url = text(body.avatarUrl, 500);
      if (Object.keys(nameFields).length) await db.updateUserProfile(req.user.id, nameFields);

      let profile;
      if (role === 'developer') {
        if (body.sphere !== undefined && !market.SPHERE_IDS.has(body.sphere)) {
          return bad(res, 'Неизвестная сфера.', 'bad_sphere');
        }
        if (body.level !== undefined && !market.LEVEL_IDS.has(body.level)) {
          return bad(res, 'Неизвестный уровень.', 'bad_level');
        }
        profile = await market.upsertDevProfile(req.user.id, {
          sphere: body.sphere,
          level: body.level,
          stack: body.stack === undefined ? undefined : String(body.stack).slice(0, 400),
          headline: body.headline === undefined ? undefined : text(body.headline, 160),
          bio: body.bio === undefined ? undefined : text(body.bio, 4000),
          city: body.city === undefined ? undefined : text(body.city, 80),
          rateHour: body.rateHour === undefined ? undefined : Math.max(0, toInt(body.rateHour, 0)),
          available: body.available === undefined ? undefined : Boolean(body.available),
          portfolio: Array.isArray(body.portfolio)
            ? body.portfolio.slice(0, 20).map((item) => ({
                title: text(item?.title, 120) ?? 'Работа',
                url: text(item?.url, 500),
                description: text(item?.description, 600),
              }))
            : undefined,
          links: body.links && typeof body.links === 'object' ? body.links : undefined,
        });
      } else {
        profile = await market.upsertClientProfile(req.user.id, {
          company: body.company === undefined ? undefined : text(body.company, 160),
          about: body.about === undefined ? undefined : text(body.about, 4000),
          city: body.city === undefined ? undefined : text(body.city, 80),
          site: body.site === undefined ? undefined : text(body.site, 300),
        });
      }

      const fresh = await db.findUserById(req.user.id);
      res.json({ user: userCard(fresh, profile) });
    } catch (error) {
      console.error('profile update error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось сохранить профиль.' });
    }
  });
}

export default registerMarketRoutes;
