import * as demo from './demoApi';

/**
 * Куда стучаться за API.
 *
 * На реальном домене мы всегда ходим на свой же origin: правило в
 * `vercel.json` проксирует `/api/*` на бэкенд. Так решаются сразу три
 * проблемы разом:
 *   1. cookie сессии становится first-party — Safari и Chrome больше не
 *      режут её как стороннюю;
 *   2. исчезает preflight и весь риск ошибиться в CORS-списке;
 *   3. браузер не обращается к домену хостинга напрямую, а у части
 *      провайдеров (в том числе узбекских) он закрыт — именно так
 *      появляется ERR_CONNECTION_CLOSED при живом сервере.
 *
 * Локальная разработка ходит по VITE_API_BASE_URL, как и раньше.
 * VITE_API_DIRECT=1 принудительно возвращает прямые запросы — на случай
 * хостинга без прокси.
 */
function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '')
    .trim()
    .replace(/\/$/, '');

  if (import.meta.env.VITE_API_DIRECT === '1') return configured;
  if (typeof window === 'undefined') return configured;

  const host = window.location.hostname;
  const local =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');

  if (local) return configured || 'http://localhost:4000';
  return '';
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * With VITE_DEMO_MODE=1 every call is answered in the browser by `demoApi`,
 * so the whole journey works from a static deployment with no server. The
 * shapes and error codes are identical, so nothing downstream changes.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

/**
 * Если сервер недоступен, предложение и Центр проектов продолжают работать
 * в браузере на демо-транспорте. Логин остаётся строгим — там подмена
 * недопустима, — а вот кнопка «Принять и подписать» не имеет права молча
 * умирать из-за спящего бесплатного хостинга.
 */
let fallbackActive = DEMO_MODE;
let sessionHint = null;

/** Кто вошёл — чтобы локальный режим знал пользователя, если сервер отвалится. */
export function rememberSession(user) {
  sessionHint = user ?? null;
  if (fallbackActive) demo.adoptSession(sessionHint);
}

export function isOfflineFallback() {
  return fallbackActive && !DEMO_MODE;
}

function fallbackWorthy(error) {
  return (
    error?.code === 'network' ||
    error?.code === 'timeout' ||
    error?.status === 503 ||
    error?.status === 502 ||
    error?.status === 404
  );
}

/**
 * Пробует настоящий API и, если он недоступен, отвечает демо-транспортом.
 * Ошибки логики (400, 401, 403) пробрасываются как есть — их надо показывать.
 */
async function callWithFallback(realCall, demoCall) {
  if (fallbackActive) return demoCall();
  try {
    return await realCall();
  } catch (error) {
    if (!fallbackWorthy(error)) throw error;
    console.warn('[api] сервер недоступен, переключаюсь на локальный режим:', error.message);
    fallbackActive = true;
    demo.adoptSession(sessionHint);
    return demoCall();
  }
}

class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown', field = null, retryAfter = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.retryAfter = retryAfter;
    this.payload = payload;
  }
}

/**
 * Every call sends credentials: the session is an httpOnly cookie, so it is
 * never readable from JavaScript and never stored by this app.
 */
// Generous by default: a free-tier host that has spun down needs 30-60s to
// wake, and a timeout there reads to the user as "broken" rather than "slow".
async function request(path, { method = 'POST', body, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new ApiError(
        'The server is taking longer than usual — it may be waking up. Please try again.',
        { code: 'timeout' }
      );
    }
    throw new ApiError('Could not reach the server. Check your connection.', { code: 'network' });
  }
  clearTimeout(timer);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.message ?? 'The server returned an error.', {
      status: response.status,
      code: payload?.code ?? 'server_error',
      field: payload?.field ?? null,
      retryAfter: payload?.retryAfter ?? null,
      payload,
    });
  }

  return payload ?? {};
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/**
 * Creates the account and emails a six-digit code to the address supplied.
 * @param {{ email: string, password: string, fullName?: string, phone?: string|null }} input
 * @returns {Promise<{ status: 'verification_sent', email: string, resendAfterSeconds: number, devCode?: string }>}
 */
export function register(input) {
  if (DEMO_MODE) return demo.register(input);
  return request('/api/auth/register', { body: input });
}

/**
 * @param {{ email: string, code: string }} input
 * @returns {Promise<{ user: object }>} — also sets the session cookie
 */
export function verifyEmail(input) {
  if (DEMO_MODE) return demo.verifyEmail(input);
  return request('/api/auth/verify-email', { body: input });
}

export function resendCode(email) {
  if (DEMO_MODE) return demo.resendCode(email);
  return request('/api/auth/resend-code', { body: { email } });
}

/**
 * @param {{ email: string, password: string }} input
 * @returns {Promise<{ user: object }>}
 * @throws {ApiError} code 'email_unverified' when the address still needs a code
 */
export function login(input) {
  if (DEMO_MODE) return demo.login(input);
  return request('/api/auth/login', { body: input });
}

export function logout() {
  if (DEMO_MODE) return demo.logout();
  return request('/api/auth/logout', { body: {} });
}

/** Resolves to null when there is no valid session, rather than throwing. */
export async function fetchCurrentUser() {
  if (DEMO_MODE) return demo.fetchCurrentUser();
  try {
    const payload = await request('/api/auth/me', { method: 'GET', timeoutMs: 60000 });
    return payload.user ?? null;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Proposal                                                            */
/* ------------------------------------------------------------------ */

export function acceptProposal(input) {
  return callWithFallback(
    () => request('/api/proposal/accept', { body: input }),
    () => demo.acceptProposal(input)
  );
}

export async function fetchAcceptance(proposalId) {
  try {
    const payload = await callWithFallback(
      () =>
        request(`/api/proposal/acceptance?proposalId=${encodeURIComponent(proposalId)}`, {
          method: 'GET',
          timeoutMs: 60000,
        }),
      () => demo.fetchAcceptance(proposalId)
    );
    return payload?.acceptance ?? payload ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Центр проектов                                                      */
/* ------------------------------------------------------------------ */

/** Публикует принятый проект на доске исполнителей. */
export async function createHubProject(input) {
  const payload = await callWithFallback(
    () => request('/api/hub/projects', { body: input }),
    () => demo.createHubProject(input)
  );
  return payload.project;
}

/** Полное состояние доски: проект, отклики, сделка, лента событий. */
export async function fetchHubProject(projectId) {
  return callWithFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}`, { method: 'GET' }),
    () => demo.fetchHubProject(projectId)
  );
}

export async function fetchHubProjects() {
  const payload = await callWithFallback(
    () => request('/api/hub/projects', { method: 'GET' }),
    () => demo.fetchHubProjects()
  );
  return payload.projects ?? [];
}

export async function fetchDevelopers(role = null) {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const payload = await callWithFallback(
    () => request(`/api/hub/developers${query}`, { method: 'GET' }),
    () => demo.fetchDevelopers(role)
  );
  return payload.developers ?? [];
}

/** Исполнитель откликается на проект. */
export async function placeBid(projectId, input) {
  const payload = await callWithFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/bids`, { body: input }),
    () => demo.placeBid(projectId, input)
  );
  return payload.bid;
}

/** Заказчик принимает отклик — сумма резервируется. */
export async function acceptBid(projectId, bidId) {
  const payload = await callWithFallback(
    () =>
      request(
        `/api/hub/projects/${encodeURIComponent(projectId)}/bids/${encodeURIComponent(bidId)}/accept`,
        { body: {} }
      ),
    () => demo.acceptBid(projectId, bidId)
  );
  return payload.deal;
}

export async function startWork(projectId) {
  const payload = await callWithFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/start`, { body: {} }),
    () => demo.startWork(projectId)
  );
  return payload.deal;
}

export async function submitWork(projectId, input) {
  const payload = await callWithFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/submit`, { body: input }),
    () => demo.submitWork(projectId, input)
  );
  return payload.deal;
}

/** Заказчик подтверждает приёмку — деньги уходят исполнителю. */
export async function releasePayment(projectId) {
  const payload = await callWithFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/release`, { body: {} }),
    () => demo.releasePayment(projectId)
  );
  return payload.deal;
}

/**
 * Мягкий откат: если сервер ещё не умеет этот маршрут, отвечаем локально,
 * но НЕ переводим всё приложение в демо-режим — остальные вызовы должны
 * продолжать ходить на живой сервер.
 */
async function callSoftFallback(realCall, demoCall) {
  if (fallbackActive) return demoCall();
  try {
    return await realCall();
  } catch (error) {
    if (!fallbackWorthy(error)) throw error;
    return demoCall();
  }
}

/** Новая волна откликов: исполнители присылают свежие цены и сроки. */
export async function refreshBids(projectId) {
  return callSoftFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/refresh-bids`, { body: {} }),
    () => demo.refreshBids(projectId)
  );
}

/** Заказчик оценивает исполнителя после выплаты. */
export async function rateDeveloper(projectId, input) {
  const payload = await callSoftFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/rate`, { body: input }),
    () => demo.rateDeveloper(projectId, input)
  );
  return payload.deal;
}

/** Выход из завершённой сделки: проект уходит в архив. */
export async function closeProject(projectId) {
  const payload = await callSoftFallback(
    () => request(`/api/hub/projects/${encodeURIComponent(projectId)}/close`, { body: {} }),
    () => demo.closeProject(projectId)
  );
  return payload.project;
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export async function getCapabilities() {
  if (DEMO_MODE) return demo.getCapabilities();
  try {
    const payload = await request('/api/capabilities', { method: 'GET', timeoutMs: 30000 });
    return { ...payload, reachable: true };
  } catch {
    return { email: true, emailMode: 'unknown', storage: 'unknown', reachable: false };
  }
}

export { ApiError, API_BASE_URL };
