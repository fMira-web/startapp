import { create } from 'zustand';
import * as api from '../lib/api';

/**
 * Session state.
 *
 * The token itself lives in an httpOnly cookie the browser manages — nothing
 * sensitive is kept here, and nothing is written to localStorage. On boot the
 * app asks the server who it is talking to.
 *
 * `screen` drives the auth surface:
 *   'login'  → email + password
 *   'register' → create an account
 *   'verify' → six-digit code just emailed to `pendingEmail`
 *
 * Роль аккаунта («заказчик» или «исполнитель») выбирается при регистрации.
 * Сервер может её ещё не знать — тогда она живёт локально, чтобы интерфейс
 * сразу открывался нужной стороной.
 */

const ROLE_KEY = 'account-role';

export function readStoredRole(email) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(ROLE_KEY) ?? '{}');
    if (email && raw[email.toLowerCase()]) return raw[email.toLowerCase()];
    return raw.__last ?? null;
  } catch {
    return null;
  }
}

function storeRole(email, role) {
  if (typeof localStorage === 'undefined' || !role) return;
  try {
    const raw = JSON.parse(localStorage.getItem(ROLE_KEY) ?? '{}');
    if (email) raw[email.toLowerCase()] = role;
    raw.__last = role;
    localStorage.setItem(ROLE_KEY, JSON.stringify(raw));
  } catch {
    /* приватный режим браузера — роль просто не переживёт перезагрузку */
  }
}

function resolveRole(user, fallback = null) {
  const fromServer = user?.role ?? user?.accountRole ?? null;
  if (fromServer === 'client' || fromServer === 'developer') return fromServer;
  return readStoredRole(user?.email) ?? fallback ?? 'client';
}

export const useAuthStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'anonymous' | 'authenticated'
  user: null,
  /** 'client' | 'developer' — от неё зависит весь интерфейс после входа. */
  role: 'client',
  screen: 'login',
  pendingEmail: null,
  pendingRole: 'client',
  devCode: null, // only populated when the backend has no mail provider
  resendAfter: 0,
  error: null,
  fieldErrors: {},
  pending: false,

  /* --- boot ----------------------------------------------------------- */

  async bootstrap() {
    try {
      const user = await api.fetchCurrentUser();
      api.rememberSession(user);
      set({
        status: user ? 'authenticated' : 'anonymous',
        user,
        role: user ? resolveRole(user) : 'client',
      });
    } catch {
      set({ status: 'anonymous', user: null });
    }
  },

  /* --- navigation ----------------------------------------------------- */

  showLogin: () => set({ screen: 'login', error: null, fieldErrors: {} }),
  showRegister: () => set({ screen: 'register', error: null, fieldErrors: {} }),
  backFromVerify: () =>
    set({ screen: 'login', error: null, fieldErrors: {}, pendingEmail: null, devCode: null }),

  setPendingRole: (pendingRole) => set({ pendingRole }),
  /** Ручное переключение стороны — человек может быть и тем, и другим. */
  setRole: (role) => {
    storeRole(get().user?.email, role);
    set({ role });
  },

  clearErrors: () => set({ error: null, fieldErrors: {} }),
  tickResend: () => set((state) => ({ resendAfter: Math.max(0, state.resendAfter - 1) })),

  /* --- actions -------------------------------------------------------- */

  async register(input) {
    set({ pending: true, error: null, fieldErrors: {} });
    try {
      const role = input.role === 'developer' ? 'developer' : 'client';
      const result = await api.register({ ...input, role });
      storeRole(input.email, role);
      set({
        pending: false,
        screen: 'verify',
        pendingEmail: result.email ?? input.email,
        pendingRole: role,
        role,
        devCode: result.devCode ?? null,
        resendAfter: result.resendAfterSeconds ?? 60,
      });
      return true;
    } catch (error) {
      set({
        pending: false,
        error: error.field ? null : error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : {},
      });
      return false;
    }
  },

  async login(input) {
    set({ pending: true, error: null, fieldErrors: {} });
    try {
      const result = await api.login(input);
      api.rememberSession(result.user);
      set({
        pending: false,
        status: 'authenticated',
        user: result.user,
        role: resolveRole(result.user),
        pendingEmail: null,
      });
      return true;
    } catch (error) {
      // An unverified account is not a failure — it needs a code.
      if (error.code === 'email_unverified') {
        set({
          pending: false,
          screen: 'verify',
          pendingEmail: error.payload?.email ?? input.email,
          devCode: error.payload?.devCode ?? null,
          resendAfter: error.payload?.resendAfterSeconds ?? error.retryAfter ?? 60,
          error: null,
        });
        return true;
      }
      set({
        pending: false,
        error: error.field ? null : error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : {},
      });
      return false;
    }
  },

  async verify(code) {
    const email = get().pendingEmail;
    if (!email) return false;
    set({ pending: true, error: null });
    try {
      const result = await api.verifyEmail({ email, code });
      api.rememberSession(result.user);
      const role = resolveRole(result.user, get().pendingRole);
      storeRole(email, role);
      set({
        pending: false,
        status: 'authenticated',
        user: result.user,
        role,
        pendingEmail: null,
        devCode: null,
      });
      return true;
    } catch (error) {
      set({ pending: false, error: error.message });
      return false;
    }
  },

  async resend() {
    const email = get().pendingEmail;
    if (!email) return;
    set({ pending: true, error: null });
    try {
      const result = await api.resendCode(email);
      set({
        pending: false,
        devCode: result.devCode ?? null,
        resendAfter: result.resendAfterSeconds ?? 60,
      });
    } catch (error) {
      set({
        pending: false,
        error: error.message,
        resendAfter: error.retryAfter ?? get().resendAfter,
      });
    }
  },

  async signOut() {
    try {
      await api.logout();
    } catch {
      /* локальное состояние важнее, чем ответ сервера */
    }
    api.rememberSession(null);
    set({
      status: 'anonymous',
      user: null,
      screen: 'login',
      pendingEmail: null,
      devCode: null,
      error: null,
      fieldErrors: {},
    });
  },
}));

export default useAuthStore;
