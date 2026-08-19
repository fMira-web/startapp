import { create } from 'zustand';
import * as api from '../lib/api';

/**
 * Сессия и роль аккаунта.
 *
 * Токен лежит в httpOnly-куке, которой управляет браузер: здесь не хранится
 * ничего чувствительного и ничего не пишется в localStorage. На старте
 * приложение спрашивает сервер, кто он такой.
 *
 * Роль («заказчик» или «программист») выбирается ровно один раз — на
 * регистрации — и дальше приходит с сервера вместе с пользователем. Клиент
 * её не переключает: функции setRole в этом сторе намеренно нет, а поле
 * `pendingRole` живёт только между «нажал зарегистрироваться» и «ввёл код»,
 * чтобы экран подтверждения знал, что показать дальше.
 *
 * `screen` управляет экраном авторизации:
 *   'login'    → почта и пароль
 *   'register' → создание аккаунта
 *   'verify'   → шестизначный код, отправленный на `pendingEmail`
 */

function readRole(user) {
  const role = user?.role;
  return role === 'developer' || role === 'client' ? role : 'client';
}

export const useAuthStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'anonymous' | 'authenticated'
  user: null,
  /** Дублирует user.role — удобно подписываться на одно поле. */
  role: null,
  screen: 'login',
  pendingEmail: null,
  pendingRole: 'client',
  devCode: null, // приходит, только когда у бэкенда нет почтового провайдера
  deliveryNote: null,
  resendAfter: 0,
  error: null,
  fieldErrors: {},
  pending: false,
  /** Аккаунт заблокирован администратором — показываем причину, а не «войдите». */
  blockedMessage: null,

  /* --- старт ---------------------------------------------------------- */

  async bootstrap() {
    try {
      const user = await api.fetchCurrentUser();
      api.rememberSession(user);
      set({
        status: user ? 'authenticated' : 'anonymous',
        user,
        role: user ? readRole(user) : null,
        blockedMessage: null,
      });
    } catch (error) {
      if (error?.code === 'account_blocked') {
        set({ status: 'anonymous', user: null, role: null, blockedMessage: error.message });
        return;
      }
      set({ status: 'anonymous', user: null, role: null });
    }
  },

  /* --- навигация по экранам ------------------------------------------- */

  showLogin: () => set({ screen: 'login', error: null, fieldErrors: {} }),
  showRegister: () => set({ screen: 'register', error: null, fieldErrors: {} }),
  backFromVerify: () =>
    set({
      screen: 'login',
      error: null,
      fieldErrors: {},
      pendingEmail: null,
      devCode: null,
      deliveryNote: null,
    }),

  setPendingRole: (pendingRole) => set({ pendingRole }),

  clearErrors: () => set({ error: null, fieldErrors: {}, blockedMessage: null }),
  tickResend: () => set((state) => ({ resendAfter: Math.max(0, state.resendAfter - 1) })),

  /* --- действия -------------------------------------------------------- */

  /**
   * @param {{ email, password, fullName?, phone?, role: 'client'|'developer',
   *           devProfile?: { sphere, level, stack, headline?, city?, rateHour? } }} input
   */
  async register(input) {
    set({ pending: true, error: null, fieldErrors: {} });
    try {
      const role = input.role === 'developer' ? 'developer' : 'client';
      const result = await api.register({ ...input, role });
      set({
        pending: false,
        screen: 'verify',
        pendingEmail: result.email ?? input.email,
        // Сервер возвращает роль, уже закреплённую за аккаунтом. Если человек
        // повторно регистрирует существующую почту с другой ролью, приедет
        // старая — и это правильный ответ, а не ошибка.
        pendingRole: result.role ?? role,
        devCode: result.devCode ?? null,
        deliveryNote: result.deliveryNote ?? null,
        resendAfter: result.resendAfterSeconds ?? 60,
        error: result.roleLocked
          ? 'У этой почты уже есть аккаунт с другой ролью. Роль сменить нельзя — мы отправили код для входа в существующий.'
          : null,
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
    set({ pending: true, error: null, fieldErrors: {}, blockedMessage: null });
    try {
      const result = await api.login(input);
      api.rememberSession(result.user);
      set({
        pending: false,
        status: 'authenticated',
        user: result.user,
        role: readRole(result.user),
        pendingEmail: null,
      });
      return true;
    } catch (error) {
      // Неподтверждённая почта — не отказ, а следующий шаг.
      if (error.code === 'email_unverified') {
        set({
          pending: false,
          screen: 'verify',
          pendingEmail: error.payload?.email ?? input.email,
          devCode: error.payload?.devCode ?? null,
          deliveryNote: error.payload?.deliveryNote ?? null,
          resendAfter: error.payload?.resendAfterSeconds ?? error.retryAfter ?? 60,
          error: null,
        });
        return true;
      }
      if (error.code === 'account_blocked') {
        set({ pending: false, error: null, blockedMessage: error.message });
        return false;
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
        role: readRole(result.user),
        pendingEmail: null,
        devCode: null,
        deliveryNote: null,
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
        deliveryNote: result.deliveryNote ?? null,
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
      role: null,
      screen: 'login',
      pendingEmail: null,
      devCode: null,
      deliveryNote: null,
      error: null,
      fieldErrors: {},
      blockedMessage: null,
    });
  },
}));

export default useAuthStore;
