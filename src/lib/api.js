import * as demo from './demoApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  ''
);

/**
 * With VITE_DEMO_MODE=1 every call is answered in the browser by `demoApi`,
 * so the whole journey works from a static deployment with no server. The
 * shapes and error codes are identical, so nothing downstream changes.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

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
  if (DEMO_MODE) return demo.acceptProposal(input);
  return request('/api/proposal/accept', { body: input });
}

export async function fetchAcceptance(proposalId) {
  if (DEMO_MODE) return demo.fetchAcceptance(proposalId);
  try {
    const payload = await request(
      `/api/proposal/acceptance?proposalId=${encodeURIComponent(proposalId)}`,
      { method: 'GET', timeoutMs: 60000 }
    );
    return payload.acceptance ?? null;
  } catch {
    return null;
  }
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
