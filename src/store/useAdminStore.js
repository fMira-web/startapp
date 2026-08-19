import { create } from 'zustand';
import * as api from '../lib/marketApi';

/**
 * Состояние админ-панели.
 *
 * Держится отдельно от биржи: данные здесь тяжелее, обновляются реже и
 * никогда не нужны обычному пользователю — незачем тащить их в общий стор.
 */

function message(error) {
  return error?.message ?? 'Действие не выполнено.';
}

export const useAdminStore = create((set, get) => ({
  tab: 'overview', // overview | users | projects | offers
  setTab: (tab) => set({ tab, error: null, notice: null }),

  loading: false,
  error: null,
  notice: null,

  overview: null,
  users: [],
  usersTotal: 0,
  userQuery: { search: '', role: '' },
  projects: [],
  projectsTotal: 0,
  projectQuery: { search: '', status: '' },
  offers: { pool: [], current: null, history: [] },

  clearNotice: () => set({ notice: null, error: null }),

  async loadOverview() {
    set({ loading: true, error: null });
    try {
      set({ overview: await api.adminOverview(), loading: false });
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },

  /* --- пользователи ---------------------------------------------------- */

  setUserQuery(key, value) {
    set({ userQuery: { ...get().userQuery, [key]: value } });
    get().loadUsers();
  },

  async loadUsers() {
    set({ loading: true, error: null });
    try {
      const payload = await api.adminUsers({ ...get().userQuery, limit: 100 });
      set({ users: payload.users ?? [], usersTotal: payload.total ?? 0, loading: false });
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },

  async blockUser(id, blocked, reason) {
    try {
      await api.adminBlockUser(id, blocked, reason);
      set({ notice: blocked ? 'Пользователь заблокирован.' : 'Блокировка снята.' });
      await get().loadUsers();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  async deleteUser(id) {
    try {
      await api.adminDeleteUser(id);
      set({ notice: 'Аккаунт удалён вместе с его проектами и откликами.' });
      await get().loadUsers();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  async setAdmin(id, isAdmin) {
    try {
      await api.adminSetAdmin(id, isAdmin);
      set({ notice: isAdmin ? 'Права администратора выданы.' : 'Права администратора сняты.' });
      await get().loadUsers();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  async setRole(id, role) {
    try {
      await api.adminSetRole(id, role);
      set({ notice: 'Роль аккаунта изменена.' });
      await get().loadUsers();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  /* --- проекты ---------------------------------------------------------- */

  setProjectQuery(key, value) {
    set({ projectQuery: { ...get().projectQuery, [key]: value } });
    get().loadProjects();
  },

  async loadProjects() {
    set({ loading: true, error: null });
    try {
      const payload = await api.adminProjects({ ...get().projectQuery, limit: 100 });
      set({ projects: payload.projects ?? [], projectsTotal: payload.total ?? 0, loading: false });
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },

  async moderate(id, moderation, note) {
    try {
      await api.adminModerate(id, moderation, note);
      set({
        notice:
          moderation === 'published'
            ? 'Проект вернулся в выдачу.'
            : moderation === 'hidden'
              ? 'Проект скрыт с доски.'
              : 'Проект отправлен на доработку.',
      });
      await get().loadProjects();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  async deleteProject(id) {
    try {
      await api.adminDeleteProject(id);
      set({ notice: 'Проект удалён.' });
      await get().loadProjects();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  /* --- предложения ------------------------------------------------------ */

  async loadOffers() {
    set({ loading: true, error: null });
    try {
      set({ offers: await api.adminOffers(), loading: false });
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },

  async createOffer(input) {
    try {
      await api.adminCreateOffer(input);
      set({ notice: 'Предложение добавлено в пул ротации.' });
      await get().loadOffers();
      return true;
    } catch (error) {
      set({ error: message(error) });
      return false;
    }
  },

  async toggleOffer(id, active) {
    try {
      await api.adminUpdateOffer(id, { active });
      await get().loadOffers();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  async deleteOffer(id) {
    try {
      await api.adminDeleteOffer(id);
      set({ notice: 'Предложение удалено из пула.' });
      await get().loadOffers();
    } catch (error) {
      set({ error: message(error) });
    }
  },
}));

export default useAdminStore;
