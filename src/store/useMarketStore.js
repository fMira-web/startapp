import { create } from 'zustand';
import * as api from '../lib/marketApi';
import { parseHash } from '../lib/router';

/**
 * Состояние биржи.
 *
 * Одно хранилище на все экраны: справочники и предложения главной живут
 * долго, лента и карточка проекта перезагружаются по требованию. Ошибки
 * держим рядом с данными, которые их вызвали, — так экран показывает
 * причину именно там, где человек её ждёт.
 */

export const EMPTY_FILTERS = {
  search: '',
  category: '',
  status: '',
  level: '',
  tags: [],
  budgetMin: '',
  budgetMax: '',
  sort: 'fresh',
};

function message(error) {
  return error?.message ?? 'Что-то пошло не так. Попробуйте ещё раз.';
}

export const useMarketStore = create((set, get) => ({
  route: parseHash(),
  setRoute: (route) => set({ route }),

  /* --- справочники ---------------------------------------------------- */

  meta: null,
  tags: [],

  async loadMeta() {
    if (get().meta) return get().meta;
    try {
      const meta = await api.fetchMeta();
      set({ meta });
      return meta;
    } catch {
      return null;
    }
  },

  async loadTags() {
    try {
      set({ tags: await api.fetchTags() });
    } catch {
      /* облако тегов — украшение, без него доска работает */
    }
  },

  /* --- предложения главной -------------------------------------------- */

  offers: null,
  offersLoading: false,
  history: [],
  historyLoading: false,

  async loadOffers() {
    set({ offersLoading: true });
    try {
      set({ offers: await api.fetchOffers(), offersLoading: false });
    } catch {
      set({ offersLoading: false });
    }
  },

  async loadHistory() {
    set({ historyLoading: true });
    try {
      set({ history: await api.fetchOffersHistory(24), historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  /* --- лента проектов -------------------------------------------------- */

  filters: { ...EMPTY_FILTERS },
  feed: { items: [], total: 0, loading: false, error: null },

  setFilter(key, value) {
    set({ filters: { ...get().filters, [key]: value } });
    get().loadFeed();
  },

  toggleTag(tag) {
    const current = get().filters.tags;
    const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    set({ filters: { ...get().filters, tags: next } });
    get().loadFeed();
  },

  resetFilters() {
    set({ filters: { ...EMPTY_FILTERS } });
    get().loadFeed();
  },

  async loadFeed() {
    const { filters } = get();
    set({ feed: { ...get().feed, loading: true, error: null } });
    try {
      const payload = await api.fetchProjects({
        search: filters.search,
        category: filters.category,
        status: filters.status,
        level: filters.level,
        tags: filters.tags,
        budgetMin: filters.budgetMin,
        budgetMax: filters.budgetMax,
        sort: filters.sort,
        limit: 40,
      });
      set({
        feed: { items: payload.projects ?? [], total: payload.total ?? 0, loading: false, error: null },
      });
    } catch (error) {
      set({ feed: { items: [], total: 0, loading: false, error: message(error) } });
    }
  },

  /** Короткая подборка для главной — свежие открытые задачи. */
  highlights: [],
  async loadHighlights() {
    try {
      const payload = await api.fetchProjects({ status: 'open', sort: 'fresh', limit: 6 });
      set({ highlights: payload.projects ?? [] });
    } catch {
      set({ highlights: [] });
    }
  },

  /* --- карточка проекта ------------------------------------------------ */

  project: null,
  projectLoading: false,
  projectError: null,
  messages: [],
  messagesError: null,

  async loadProject(id) {
    set({ projectLoading: true, projectError: null });
    try {
      const payload = await api.fetchProject(id);
      set({ project: payload, projectLoading: false });
      return payload;
    } catch (error) {
      set({ project: null, projectLoading: false, projectError: message(error) });
      return null;
    }
  },

  async loadMessages(id) {
    try {
      set({ messages: await api.fetchMessages(id), messagesError: null });
    } catch (error) {
      // 403 здесь — норма: посторонний просто не участник переписки.
      set({ messages: [], messagesError: error?.status === 403 ? null : message(error) });
    }
  },

  async sendMessage(id, body) {
    const message_ = await api.sendMessage(id, body);
    set({ messages: [...get().messages, message_] });
  },

  async placeBid(projectId, input) {
    await api.placeBid(projectId, input);
    await get().loadProject(projectId);
  },

  async withdrawBid(projectId, bidId) {
    await api.withdrawBid(projectId, bidId);
    await get().loadProject(projectId);
  },

  async acceptBid(projectId, bidId) {
    await api.acceptBid(projectId, bidId);
    await get().loadProject(projectId);
  },

  async changeStatus(projectId, status) {
    await api.setProjectStatus(projectId, status);
    await get().loadProject(projectId);
  },

  async leaveReview(projectId, input) {
    await api.leaveReview(projectId, input);
    await get().loadProject(projectId);
  },

  async removeProject(projectId) {
    await api.deleteProject(projectId);
    set({ project: null });
    await get().loadFeed();
  },

  /* --- личный кабинет --------------------------------------------------- */

  cabinet: null,
  cabinetLoading: false,
  cabinetError: null,

  async loadCabinet() {
    set({ cabinetLoading: true, cabinetError: null });
    try {
      set({ cabinet: await api.fetchCabinet(), cabinetLoading: false });
    } catch (error) {
      set({ cabinet: null, cabinetLoading: false, cabinetError: message(error) });
    }
  },

  async saveProfile(input) {
    await api.saveProfile(input);
    await get().loadCabinet();
  },

  /* --- каталог исполнителей --------------------------------------------- */

  developers: { items: [], total: 0, loading: false, error: null },
  devFilters: { sphere: '', level: '', search: '' },

  setDevFilter(key, value) {
    set({ devFilters: { ...get().devFilters, [key]: value } });
    get().loadDevelopers();
  },

  async loadDevelopers() {
    set({ developers: { ...get().developers, loading: true, error: null } });
    try {
      const payload = await api.fetchDevelopers({ ...get().devFilters, limit: 40 });
      set({
        developers: {
          items: payload.developers ?? [],
          total: payload.total ?? 0,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({ developers: { items: [], total: 0, loading: false, error: message(error) } });
    }
  },

  /* --- публичный профиль ------------------------------------------------ */

  publicProfile: null,
  publicProfileLoading: false,
  publicProfileError: null,

  async loadPublicProfile(id) {
    set({ publicProfileLoading: true, publicProfileError: null });
    try {
      set({ publicProfile: await api.fetchPublicProfile(id), publicProfileLoading: false });
    } catch (error) {
      set({ publicProfile: null, publicProfileLoading: false, publicProfileError: message(error) });
    }
  },
}));

export default useMarketStore;
