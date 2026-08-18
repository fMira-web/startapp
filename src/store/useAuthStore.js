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
 */
export const useAuthStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'anonymous' | 'authenticated'
  user: null,
  screen: 'login',
  pendingEmail: null,
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
      set({ status: user ? 'authenticated' : 'anonymous', user });
    } catch {
      set({ status: 'anonymous', user: null });
    }
  },

  /* --- navigation ----------------------------------------------------- */

  showLogin: () => set({ screen: 'login', error: null, fieldErrors: {} }),
  showRegister: () => set({ screen: 'register', error: null, fieldErrors: {} }),
  backFromVerify: () =>
    set({ screen: 'login', error: null, fieldErrors: {}, pendingEmail: null, devCode: null }),

  clearErrors: () => set({ error: null, fieldErrors: {} }),
  tickResend: () => set((state) => ({ resendAfter: Math.max(0, state.resendAfter - 1) })),

  /* --- actions -------------------------------------------------------- */

  async register(input) {
    set({ pending: true, error: null, fieldErrors: {} });
    try {
      const result = await api.register(input);
      set({
        pending: false,
        screen: 'verify',
        pendingEmail: result.email ?? input.email,
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
      set({ pending: false, status: 'authenticated', user: result.user, pendingEmail: null });
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
      set({
        pending: false,
        status: 'authenticated',
        user: result.user,
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
