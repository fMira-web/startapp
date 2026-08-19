/**
 * Админ-панель.
 *
 * Иерархия прав намеренно двухуровневая:
 *
 *   суперадминистратор — аккаунт с почтой владельца площадки (OWNER_EMAIL).
 *     Полный доступ, включая выдачу и отзыв прав администратора и смену
 *     роли аккаунта. Его самого нельзя заблокировать, удалить и разжаловать —
 *     иначе площадка осталась бы без владельца после одного неверного клика.
 *
 *   администратор — аккаунт с флагом is_admin. Видит всех пользователей,
 *     блокирует и удаляет их, модерирует проекты и ведёт пул предложений.
 */

import * as db from './db.js';
import * as market from './market-db.js';
import * as offers from './offers.js';
import { requireUser, requireAdmin, requireOwner, isOwner, OWNER_EMAIL } from './auth.js';

function bad(res, message, code = 'bad_input') {
  return res.status(400).json({ code, message });
}

function notFound(res, message = 'Не найдено.') {
  return res.status(404).json({ code: 'not_found', message });
}

function toInt(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function adminUserRow(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name ?? null,
    phone: user.phone ?? null,
    role: user.role ?? 'client',
    isAdmin: user.is_admin === true,
    isOwner: isOwner(user),
    isBlocked: user.is_blocked === true,
    blockedReason: user.blocked_reason ?? null,
    emailVerified: user.email_verified === true,
    createdAt: user.created_at ?? null,
    lastLoginAt: user.last_login_at ?? null,
  };
}

async function audit(req, action, target, details) {
  try {
    await market.logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action,
      target,
      details,
    });
  } catch (error) {
    console.warn('Не удалось записать действие в журнал:', error.message);
  }
}

export function registerAdminRoutes(app) {
  // Все маршруты ниже требуют входа и прав администратора.
  app.use('/api/admin', requireUser, requireAdmin);

  /* ================================================================ */
  /* Сводка                                                            */
  /* ================================================================ */

  app.get('/api/admin/overview', async (req, res) => {
    try {
      const [users, marketStats, log] = await Promise.all([
        db.userStats(),
        market.marketStats(),
        market.listAdminLog(20),
      ]);
      res.json({
        users,
        market: marketStats,
        offers: { rotationDays: offers.ROTATION_DAYS, slots: offers.SLOTS },
        owner: { email: OWNER_EMAIL, isYou: isOwner(req.user) },
        log,
      });
    } catch (error) {
      console.error('admin overview error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось собрать сводку.' });
    }
  });

  app.get('/api/admin/log', async (req, res) => {
    try {
      res.json({ log: await market.listAdminLog(Math.min(300, toInt(req.query?.limit, 100))) });
    } catch (error) {
      console.error('admin log error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось прочитать журнал.' });
    }
  });

  /* ================================================================ */
  /* Пользователи                                                      */
  /* ================================================================ */

  app.get('/api/admin/users', async (req, res) => {
    try {
      const query = req.query ?? {};
      const { users, total } = await db.listUsers({
        search: String(query.search ?? ''),
        role: query.role === 'client' || query.role === 'developer' ? query.role : null,
        limit: Math.max(1, Math.min(200, toInt(query.limit, 50))),
        offset: Math.max(0, toInt(query.offset, 0)),
      });

      // Профиль подмешиваем, чтобы в списке сразу была видна специализация.
      const rows = await Promise.all(
        users.map(async (user) => {
          const base = adminUserRow(user);
          if ((user.role ?? 'client') === 'developer') {
            const profile = await market.getDevProfile(user.id);
            return {
              ...base,
              sphere: profile?.sphere ?? null,
              level: profile?.level ?? null,
              stack: profile?.stack ?? '',
              rating: Number(profile?.rating ?? 0),
              projectsDone: Number(profile?.projects_done ?? 0),
            };
          }
          const profile = await market.getClientProfile(user.id);
          return {
            ...base,
            company: profile?.company ?? null,
            rating: Number(profile?.rating ?? 0),
            projectsPosted: Number(profile?.projects_posted ?? 0),
          };
        })
      );

      res.json({ users: rows, total });
    } catch (error) {
      console.error('admin users error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить пользователей.' });
    }
  });

  /** Блокировка и разблокировка. Владельца площадки трогать нельзя. */
  app.post('/api/admin/users/:id/block', async (req, res) => {
    try {
      const user = await db.findUserById(req.params.id);
      if (!user) return notFound(res, 'Пользователь не найден.');
      if (isOwner(user)) return bad(res, 'Суперадминистратора нельзя заблокировать.', 'owner_protected');
      if (user.id === req.user.id) return bad(res, 'Нельзя заблокировать самого себя.', 'self_protected');
      if (user.is_admin === true && !isOwner(req.user)) {
        return bad(res, 'Блокировать администратора может только суперадминистратор.', 'owner_only');
      }

      const blocked = req.body?.blocked !== false;
      const reason = text(req.body?.reason, 300);
      const updated = await db.setBlocked(user.id, blocked, reason);
      await audit(req, blocked ? 'user.block' : 'user.unblock', user.email, reason);

      res.json({ user: adminUserRow(updated) });
    } catch (error) {
      console.error('admin block error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось изменить блокировку.' });
    }
  });

  /** Удаление аккаунта вместе со всем, что к нему привязано (каскад по FK). */
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const user = await db.findUserById(req.params.id);
      if (!user) return notFound(res, 'Пользователь не найден.');
      if (isOwner(user)) return bad(res, 'Суперадминистратора нельзя удалить.', 'owner_protected');
      if (user.id === req.user.id) return bad(res, 'Нельзя удалить собственный аккаунт.', 'self_protected');
      if (user.is_admin === true && !isOwner(req.user)) {
        return bad(res, 'Удалить администратора может только суперадминистратор.', 'owner_only');
      }

      await db.deleteUser(user.id);
      await audit(req, 'user.delete', user.email, { role: user.role });
      res.json({ deleted: true });
    } catch (error) {
      console.error('admin delete user error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось удалить пользователя.' });
    }
  });

  /**
   * Выдача и отзыв прав администратора — только суперадминистратор.
   * Иначе первый же назначенный админ смог бы разжаловать остальных.
   */
  app.post('/api/admin/users/:id/admin', requireOwner, async (req, res) => {
    try {
      const user = await db.findUserById(req.params.id);
      if (!user) return notFound(res, 'Пользователь не найден.');
      if (isOwner(user)) return bad(res, 'Права суперадминистратора снять нельзя.', 'owner_protected');

      const grant = req.body?.isAdmin !== false;
      const updated = await db.setAdmin(user.id, grant);
      await audit(req, grant ? 'user.grant_admin' : 'user.revoke_admin', user.email, null);

      res.json({ user: adminUserRow(updated) });
    } catch (error) {
      console.error('admin grant error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось изменить права.' });
    }
  });

  /**
   * Смена роли. Обычному пользователю это недоступно вовсе — роль
   * фиксируется при регистрации. Ручка существует ровно для одного
   * сценария: человек ошибся при регистрации и написал владельцу.
   */
  app.post('/api/admin/users/:id/role', requireOwner, async (req, res) => {
    try {
      const user = await db.findUserById(req.params.id);
      if (!user) return notFound(res, 'Пользователь не найден.');

      const role = req.body?.role;
      if (role !== 'client' && role !== 'developer') return bad(res, 'Роль может быть client или developer.', 'bad_role');
      if ((user.role ?? 'client') === role) return res.json({ user: adminUserRow(user) });

      const updated = await db.adminSetRole(user.id, role);
      // Профиль под новую роль создаётся сразу, иначе страница профиля
      // окажется пустой, а каталог — неполным.
      if (role === 'developer') await market.upsertDevProfile(user.id, {});
      else await market.upsertClientProfile(user.id, {});

      await audit(req, 'user.set_role', user.email, { from: user.role, to: role });
      res.json({ user: adminUserRow(updated) });
    } catch (error) {
      console.error('admin role error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось сменить роль.' });
    }
  });

  /* ================================================================ */
  /* Модерация проектов                                                */
  /* ================================================================ */

  app.get('/api/admin/projects', async (req, res) => {
    try {
      const query = req.query ?? {};
      const { projects, total } = await market.listProjects({
        search: String(query.search ?? ''),
        status: market.STATUS_IDS.has(query.status) ? query.status : null,
        category: market.CATEGORY_IDS.has(query.category) ? query.category : null,
        includeHidden: true,
        limit: Math.max(1, Math.min(200, toInt(query.limit, 50))),
        offset: Math.max(0, toInt(query.offset, 0)),
      });

      const owners = await Promise.all(projects.map((project) => db.findUserById(project.owner_id)));
      res.json({
        total,
        projects: projects.map((project, index) => ({
          id: project.id,
          title: project.title,
          category: project.category,
          status: project.status,
          moderation: project.moderation,
          moderationNote: project.moderation_note ?? null,
          budgetMin: Number(project.budget_min),
          budgetMax: Number(project.budget_max),
          currency: project.currency,
          bidsCount: Number(project.bids_count ?? 0),
          views: Number(project.views ?? 0),
          createdAt: project.created_at,
          owner: owners[index]
            ? { id: owners[index].id, email: owners[index].email, fullName: owners[index].full_name }
            : null,
        })),
      });
    } catch (error) {
      console.error('admin projects error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить проекты.' });
    }
  });

  /** Снять с публикации / вернуть / отправить на доработку. */
  app.post('/api/admin/projects/:id/moderation', async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');

      const state = req.body?.moderation;
      if (!market.MODERATION_STATES.includes(state)) {
        return bad(res, 'Состояние может быть published, hidden или pending.', 'bad_moderation');
      }
      const note = text(req.body?.note, 500);

      const updated = await market.updateProject(project.id, {
        moderation: state,
        moderation_note: note,
      });
      await market.addEvent({
        projectId: project.id,
        kind: `moderation:${state}`,
        message:
          state === 'published'
            ? 'Проект возвращён в публикацию модератором.'
            : state === 'hidden'
              ? `Проект скрыт модератором${note ? `: ${note}` : '.'}`
              : `Проект отправлен на доработку${note ? `: ${note}` : '.'}`,
        actorId: req.user.id,
      });
      await audit(req, 'project.moderation', project.id, { state, note });

      res.json({
        project: {
          id: updated.id,
          moderation: updated.moderation,
          moderationNote: updated.moderation_note ?? null,
        },
      });
    } catch (error) {
      console.error('admin moderation error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось изменить модерацию.' });
    }
  });

  app.delete('/api/admin/projects/:id', async (req, res) => {
    try {
      const project = await market.getProject(req.params.id);
      if (!project) return notFound(res, 'Проект не найден.');
      await market.deleteProject(project.id);
      await audit(req, 'project.delete', project.id, { title: project.title });
      res.json({ deleted: true });
    } catch (error) {
      console.error('admin project delete error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось удалить проект.' });
    }
  });

  /* ================================================================ */
  /* Пул предложений главной страницы                                  */
  /* ================================================================ */

  app.get('/api/admin/offers', async (_req, res) => {
    try {
      const [pool, current, history] = await Promise.all([
        market.listOffers({}),
        offers.currentOffers({ persist: false }),
        offers.offersHistory({ limit: 12 }),
      ]);
      res.json({
        pool: pool.map((offer) => ({
          id: offer.id,
          slug: offer.slug,
          title: offer.title,
          subtitle: offer.subtitle,
          body: offer.body,
          ctaLabel: offer.cta_label,
          ctaHref: offer.cta_href,
          accent: offer.accent,
          weight: Number(offer.weight ?? 1),
          active: offer.active !== false,
          createdAt: offer.created_at,
        })),
        current,
        history,
      });
    } catch (error) {
      console.error('admin offers error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось загрузить предложения.' });
    }
  });

  app.post('/api/admin/offers', async (req, res) => {
    try {
      const body = req.body ?? {};
      const title = text(body.title, 160);
      if (!title) return bad(res, 'Нужен заголовок предложения.', 'bad_title');

      const slug =
        text(body.slug, 80)?.toLowerCase().replace(/[^a-z0-9-]+/g, '-') ??
        `offer-${Date.now().toString(36)}`;

      const offer = await market.createOffer({
        slug,
        title,
        subtitle: text(body.subtitle, 200),
        body: text(body.body, 1000),
        ctaLabel: text(body.ctaLabel, 60),
        ctaHref: text(body.ctaHref, 300),
        accent: ['brand', 'signal', 'amber'].includes(body.accent) ? body.accent : 'brand',
        weight: Math.max(1, Math.min(10, toInt(body.weight, 1))),
        active: body.active !== false,
        createdBy: req.user.id,
      });
      await audit(req, 'offer.create', slug, { title });

      res.status(201).json({ offer });
    } catch (error) {
      console.error('admin offer create error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось создать предложение.' });
    }
  });

  app.patch('/api/admin/offers/:id', async (req, res) => {
    try {
      const body = req.body ?? {};
      const patch = {};
      if (body.title !== undefined) patch.title = text(body.title, 160);
      if (body.subtitle !== undefined) patch.subtitle = text(body.subtitle, 200);
      if (body.body !== undefined) patch.body = text(body.body, 1000);
      if (body.ctaLabel !== undefined) patch.cta_label = text(body.ctaLabel, 60);
      if (body.ctaHref !== undefined) patch.cta_href = text(body.ctaHref, 300);
      if (body.accent !== undefined) {
        patch.accent = ['brand', 'signal', 'amber'].includes(body.accent) ? body.accent : 'brand';
      }
      if (body.weight !== undefined) patch.weight = Math.max(1, Math.min(10, toInt(body.weight, 1)));
      if (body.active !== undefined) patch.active = Boolean(body.active);

      const offer = await market.updateOffer(req.params.id, patch);
      if (!offer) return notFound(res, 'Предложение не найдено.');
      await audit(req, 'offer.update', offer.slug, patch);

      res.json({ offer });
    } catch (error) {
      console.error('admin offer update error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось обновить предложение.' });
    }
  });

  app.delete('/api/admin/offers/:id', async (req, res) => {
    try {
      const offer = await market.getOffer(req.params.id);
      if (!offer) return notFound(res, 'Предложение не найдено.');
      await market.deleteOffer(offer.id);
      await audit(req, 'offer.delete', offer.slug, null);
      res.json({ deleted: true });
    } catch (error) {
      console.error('admin offer delete error:', error);
      res.status(500).json({ code: 'server_error', message: 'Не удалось удалить предложение.' });
    }
  });
}

export default registerAdminRoutes;
