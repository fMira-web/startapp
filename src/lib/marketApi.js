import { apiRequest } from './api';

/**
 * Клиент биржи.
 *
 * Тонкий слой над общим `request`: собирает query-строку, разворачивает
 * конверты ответов и ничего не кеширует — кеш живёт в сторах. Ошибки летят
 * наверх как ApiError, чтобы интерфейс показывал текст сервера, а не свой
 * выдуманный.
 */

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' ) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const get = (path) => apiRequest(path, { method: 'GET' });
const post = (path, body = {}) => apiRequest(path, { method: 'POST', body });
const patch = (path, body = {}) => apiRequest(path, { method: 'PATCH', body });
const remove = (path) => apiRequest(path, { method: 'DELETE' });

/* ------------------------------------------------------------------ */
/* Справочники и главная                                               */
/* ------------------------------------------------------------------ */

export const fetchMeta = () => get('/api/market/meta');
export const fetchTags = () => get('/api/market/tags').then((payload) => payload.tags ?? []);
export const fetchOffers = () => get('/api/market/offers');
export const fetchOffersHistory = (limit = 20) =>
  get(`/api/market/offers/history${qs({ limit })}`).then((payload) => payload.windows ?? []);

/* ------------------------------------------------------------------ */
/* Проекты                                                             */
/* ------------------------------------------------------------------ */

export const fetchProjects = (filters = {}) => get(`/api/market/projects${qs(filters)}`);
export const fetchProject = (id) => get(`/api/market/projects/${encodeURIComponent(id)}`);
export const createProject = (input) =>
  post('/api/market/projects', input).then((payload) => payload.project);
export const updateProject = (id, patchBody) =>
  patch(`/api/market/projects/${encodeURIComponent(id)}`, patchBody).then((payload) => payload.project);
export const deleteProject = (id) => remove(`/api/market/projects/${encodeURIComponent(id)}`);
export const setProjectStatus = (id, status) =>
  post(`/api/market/projects/${encodeURIComponent(id)}/status`, { status }).then((p) => p.project);

/* ------------------------------------------------------------------ */
/* Отклики                                                             */
/* ------------------------------------------------------------------ */

export const placeBid = (projectId, input) =>
  post(`/api/market/projects/${encodeURIComponent(projectId)}/bids`, input).then((p) => p.bid);
export const withdrawBid = (projectId, bidId) =>
  remove(`/api/market/projects/${encodeURIComponent(projectId)}/bids/${encodeURIComponent(bidId)}`);
export const acceptBid = (projectId, bidId) =>
  post(`/api/market/projects/${encodeURIComponent(projectId)}/bids/${encodeURIComponent(bidId)}/accept`);

/* ------------------------------------------------------------------ */
/* Переписка и отзывы                                                  */
/* ------------------------------------------------------------------ */

export const fetchMessages = (projectId) =>
  get(`/api/market/projects/${encodeURIComponent(projectId)}/messages`).then((p) => p.messages ?? []);
export const sendMessage = (projectId, body) =>
  post(`/api/market/projects/${encodeURIComponent(projectId)}/messages`, { body }).then((p) => p.message);
export const leaveReview = (projectId, input) =>
  post(`/api/market/projects/${encodeURIComponent(projectId)}/reviews`, input);

/* ------------------------------------------------------------------ */
/* Профили                                                             */
/* ------------------------------------------------------------------ */

export const fetchDevelopers = (filters = {}) => get(`/api/market/developers${qs(filters)}`);
export const fetchPublicProfile = (id) => get(`/api/market/users/${encodeURIComponent(id)}`);
export const fetchCabinet = () => get('/api/market/me');
export const saveProfile = (input) => patch('/api/market/me/profile', input).then((p) => p.user);

/* ------------------------------------------------------------------ */
/* Админ-панель                                                        */
/* ------------------------------------------------------------------ */

export const adminOverview = () => get('/api/admin/overview');
export const adminUsers = (filters = {}) => get(`/api/admin/users${qs(filters)}`);
export const adminBlockUser = (id, blocked, reason = null) =>
  post(`/api/admin/users/${encodeURIComponent(id)}/block`, { blocked, reason }).then((p) => p.user);
export const adminDeleteUser = (id) => remove(`/api/admin/users/${encodeURIComponent(id)}`);
export const adminSetAdmin = (id, isAdmin) =>
  post(`/api/admin/users/${encodeURIComponent(id)}/admin`, { isAdmin }).then((p) => p.user);
export const adminSetRole = (id, role) =>
  post(`/api/admin/users/${encodeURIComponent(id)}/role`, { role }).then((p) => p.user);
export const adminProjects = (filters = {}) => get(`/api/admin/projects${qs(filters)}`);
export const adminModerate = (id, moderation, note = null) =>
  post(`/api/admin/projects/${encodeURIComponent(id)}/moderation`, { moderation, note });
export const adminDeleteProject = (id) => remove(`/api/admin/projects/${encodeURIComponent(id)}`);
export const adminOffers = () => get('/api/admin/offers');
export const adminCreateOffer = (input) => post('/api/admin/offers', input).then((p) => p.offer);
export const adminUpdateOffer = (id, input) =>
  patch(`/api/admin/offers/${encodeURIComponent(id)}`, input).then((p) => p.offer);
export const adminDeleteOffer = (id) => remove(`/api/admin/offers/${encodeURIComponent(id)}`);
