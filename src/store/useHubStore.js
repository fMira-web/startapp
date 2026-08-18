import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../lib/api';
import { PLATFORM_FEE_RATE } from '../data/hubData';

/**
 * Состояние «Центра проектов».
 *
 * Одна доска на одно принятое предложение: проект с бюджетом, отклики
 * исполнителей, выбранная сделка и лента событий. Сервер — источник правды,
 * store лишь держит последний снимок и знает, от чьего лица мы смотрим.
 */
export const useHubStore = create()(
  persist(
    (set, get) => ({
      /** Какой экран открыт: предложение или Центр проектов. */
      view: 'proposal',
      projectId: null,
      project: null,
      bids: [],
      deal: null,
      events: [],
      developers: [],

      loading: false,
      error: null,
      pendingAction: null,

      /** От чьего лица открыта доска. */
      viewer: 'client', // 'client' | 'developer'
      actingDevId: 'dev-diyora',

      setView: (view) => set({ view }),
      setViewer: (viewer) => set({ viewer, error: null }),
      setActingDev: (actingDevId) => set({ actingDevId }),
      clearError: () => set({ error: null }),

      /** Публикует принятое предложение на доске. Идемпотентно. */
      async publish({ proposalId, title, summary, budget, currency, weeks, lines }) {
        set({ loading: true, error: null });
        try {
          const project = await api.createHubProject({
            proposalId,
            title,
            summary,
            budget,
            currency,
            weeks,
            lines,
          });
          set({ projectId: project.id, project, loading: false });
          await get().refresh();
          return project;
        } catch (error) {
          set({ loading: false, error: error.message ?? 'Не удалось опубликовать проект.' });
          return null;
        }
      },

      async refresh() {
        const projectId = get().projectId;
        if (!projectId) return;
        set({ loading: true });
        try {
          const state = await api.fetchHubProject(projectId);
          set({
            project: state.project,
            bids: state.bids ?? [],
            deal: state.deal ?? null,
            events: state.events ?? [],
            developers: state.developers ?? [],
            loading: false,
            error: null,
          });
        } catch (error) {
          // Проект мог не сохраниться (например, сервер перезапустился) —
          // это не повод показывать пустой экран с красной ошибкой.
          set({
            loading: false,
            error: error.status === 404 ? null : (error.message ?? 'Не удалось обновить доску.'),
            ...(error.status === 404 ? { projectId: null, project: null } : {}),
          });
        }
      },

      async run(action, fn) {
        set({ pendingAction: action, error: null });
        try {
          await fn();
          await get().refresh();
          set({ pendingAction: null });
          return true;
        } catch (error) {
          set({ pendingAction: null, error: error.message ?? 'Действие не выполнено.' });
          return false;
        }
      },

      placeBid(input) {
        const projectId = get().projectId;
        return get().run('bid', () => api.placeBid(projectId, input));
      },

      acceptBid(bidId) {
        const projectId = get().projectId;
        return get().run(`accept:${bidId}`, () => api.acceptBid(projectId, bidId));
      },

      startWork() {
        const projectId = get().projectId;
        return get().run('start', () => api.startWork(projectId));
      },

      submitWork(input) {
        const projectId = get().projectId;
        return get().run('submit', () => api.submitWork(projectId, input));
      },

      releasePayment() {
        const projectId = get().projectId;
        return get().run('release', () => api.releasePayment(projectId));
      },

      reset: () =>
        set({
          projectId: null,
          project: null,
          bids: [],
          deal: null,
          events: [],
          error: null,
          pendingAction: null,
        }),
    }),
    {
      name: 'hub-board',
      version: 1,
      partialize: (state) => ({
        view: state.view,
        projectId: state.projectId,
        viewer: state.viewer,
        actingDevId: state.actingDevId,
      }),
    }
  )
);

/** Разложение суммы сделки: комиссия площадки и выплата исполнителю. */
export function dealSplit(amount) {
  const fee = Math.round(Number(amount ?? 0) * PLATFORM_FEE_RATE);
  return { amount: Number(amount ?? 0), fee, payout: Number(amount ?? 0) - fee };
}

export default useHubStore;
