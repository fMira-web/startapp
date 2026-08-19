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
      /** Какой экран открыт: Центр проектов или пример предложения. */
      view: 'hub',
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

      /** Список исполнителей нужен и без проекта — на экране новой задачи. */
      async loadDevelopers() {
        if (get().developers.length) return;
        try {
          const developers = await api.fetchDevelopers();
          set({ developers });
        } catch {
          // Витрина исполнителей не критична: молча оставляем пустой список.
        }
      },

      async refresh() {
        const projectId = get().projectId;
        if (!projectId) {
          await get().loadDevelopers();
          return;
        }
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

      /**
       * Пересчитать отклики: исполнители присылают новые цены и сроки.
       * Раньше на доске висела одна и та же цифра — теперь рынок живой.
       */
      async refreshBids() {
        const projectId = get().projectId;
        if (!projectId) return false;
        set({ pendingAction: 'rebid', error: null });
        try {
          await api.refreshBids(projectId);
        } catch {
          // Даже если сервер не умеет пересчёт, доску всё равно обновим.
        }
        await get().refresh();
        set({ pendingAction: null });
        return true;
      },

      /**
       * Оценка исполнителя звёздами — доступна после выплаты.
       *
       * Звезда обязана срабатывать всегда: если сервер ещё не знает маршрут
       * `/rate`, оценка проставляется локально, а не падает красной ошибкой.
       */
      async rateDeveloper({ rating, comment } = {}) {
        const projectId = get().projectId;
        const value = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
        if (!value) {
          set({ error: 'Поставьте оценку от 1 до 5.' });
          return false;
        }

        const optimistic = {
          client_rating: value,
          client_comment: comment?.trim() || null,
          rated_at: new Date().toISOString(),
        };

        set((state) => ({
          pendingAction: 'rate',
          error: null,
          deal: state.deal ? { ...state.deal, ...optimistic } : state.deal,
        }));

        try {
          const serverDeal = await api.rateDeveloper(projectId, { rating: value, comment });
          if (serverDeal) {
            await get().refresh();
            set((state) => ({
              // Старый сервер может вернуть сделку без оценки — тогда
              // оставляем ту, что человек только что поставил.
              deal: state.deal?.client_rating
                ? state.deal
                : { ...(state.deal ?? {}), ...optimistic },
            }));
          }
        } catch {
          // Оценка уже стоит в интерфейсе — молча остаёмся на локальной.
        }

        // Локально двигаем рейтинг исполнителя в витрине, чтобы оценка была
        // видна сразу, а не только после перезапуска сервера.
        set((state) => {
          const devId = state.deal?.dev_id;
          if (!devId) return { pendingAction: null };
          return {
            pendingAction: null,
            developers: state.developers.map((dev) => {
              if (dev.id !== devId) return dev;
              const count = Math.max(1, Number(dev.projects_done) || 1);
              const next = (Number(dev.rating) * count + value) / (count + 1);
              return { ...dev, rating: Math.round(next * 10) / 10, projects_done: count + 1 };
            }),
          };
        });

        return true;
      },

      /**
       * Выход из завершённой сделки. Проект уходит в архив, доска очищается —
       * человек возвращается к экрану новой задачи, а не застревает на
       * закрытой сделке. Доступно обеим сторонам.
       */
      async closeDeal() {
        const projectId = get().projectId;
        if (!projectId) return true;
        set({ pendingAction: 'close', error: null });
        try {
          await api.closeProject(projectId);
        } catch {
          // Даже если сервер не смог заархивировать проект, держать человека
          // на закрытой сделке нельзя — доску очищаем в любом случае.
        }
        set({
          projectId: null,
          project: null,
          bids: [],
          deal: null,
          events: [],
          pendingAction: null,
          error: null,
        });
        return true;
      },

      /**
       * Своя задача: заказчик описывает работу сам, бюджет приходит из формы.
       * Это отдельный путь от «принять предложение» — здесь нет шаблона.
       */
      async createCustomProject(input) {
        set({ loading: true, error: null });
        try {
          const project = await api.createHubProject({
            proposalId: `TASK-${Date.now().toString(36).toUpperCase()}`,
            title: input.title,
            summary: input.summary,
            budget: input.budget,
            currency: 'UZS',
            weeks: input.weeks ?? null,
            roleIds: input.roleIds ?? [],
            brief: input.brief ?? null,
            lines: (input.roleIds ?? []).map((id) => ({ id, name: id, amount: 0 })),
          });
          set({ projectId: project.id, project, view: 'hub', loading: false });
          await get().refresh();
          return project;
        } catch (error) {
          set({ loading: false, error: error.message ?? 'Не удалось опубликовать задачу.' });
          return null;
        }
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
      version: 2,
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
