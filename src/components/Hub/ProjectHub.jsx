import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  CircleDot,
  Handshake,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useMeta, useTemplate } from '../../store/useQuoteStore';
import { useHubStore } from '../../store/useHubStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatCurrency, formatAlternate, formatDateTime, pluralize } from '../../lib/format';
import {
  PLATFORM_FEE_RATE,
  PROJECT_STATUS,
  ROLE_BY_ID,
  hoursFor,
  splitBudget,
} from '../../data/hubData';
import { ICON, STROKE } from '../../lib/icons';
import DeveloperBoard from './DeveloperBoard';
import DealPanel from './DealPanel';
import DeveloperProfile from './DeveloperProfile';
import NewProjectForm from './NewProjectForm';
import HubHero from './HubHero';

function StatusPill({ status }) {
  const entry = PROJECT_STATUS[status] ?? PROJECT_STATUS.open;
  const tone =
    entry.tone === 'signal'
      ? 'bg-signal-tint text-signal ring-signal/20'
      : entry.tone === 'warn'
        ? 'bg-surface-sunken text-ink-soft ring-line-strong'
        : 'bg-brand-tint text-brand ring-brand/20';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${tone}`}
    >
      <CircleDot size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
      {entry.label}
    </span>
  );
}

function ProjectCard({ project }) {
  const meta = useMeta();
  const lines = useMemo(() => {
    try {
      return JSON.parse(project.line_items ?? '[]');
    } catch {
      return [];
    }
  }, [project.line_items]);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-col gap-5 border-b border-line px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-caps">Проект {project.proposal_id}</p>
            <StatusPill status={project.status} />
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            {project.title}
          </h2>
          {project.summary && (
            <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
              {project.summary}
            </p>
          )}
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="tnum text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">
            {formatCurrency(project.budget, meta)}
          </p>
          <p className="tnum mt-0.5 text-sm text-ink-muted">
            {formatAlternate(project.budget, meta)}
          </p>
          {project.weeks && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <CalendarDays size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              срок {project.weeks} {pluralize(project.weeks, ['неделя', 'недели', 'недель'])}
            </p>
          )}
        </div>
      </div>

      {lines.length > 0 && (
        <div className="px-6 py-5 sm:px-8">
          <p className="label-caps">Что входит в бюджет</p>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-2">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5"
              >
                <span className="min-w-0 truncate text-[0.8125rem] text-ink-soft">{line.name}</span>
                <span className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                  {line.amount > 0 ? formatCurrency(line.amount, meta) : 'Включено'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function BudgetBreakdown({ project, developers }) {
  const meta = useMeta();
  const { fee, pool, roles } = useMemo(() => splitBudget(Number(project.budget)), [project.budget]);

  const averageRate = useMemo(() => {
    const map = {};
    for (const dev of developers) {
      (map[dev.role] ??= []).push(Number(dev.rate_hour));
    }
    return Object.fromEntries(
      Object.entries(map).map(([role, rates]) => [
        role,
        Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
      ])
    );
  }, [developers]);

  return (
    <section aria-labelledby="budget-heading" className="mt-12">
      <div className="flex flex-col gap-3 border-t border-line pt-8">
        <p className="label-caps">Бюджет</p>
        <h2
          id="budget-heading"
          className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]"
        >
          Как делится сумма проекта
        </h2>
        <p className="measure text-[0.9375rem] leading-relaxed text-ink-muted">
          Комиссия площадки — {Math.round(PLATFORM_FEE_RATE * 100)}% ({formatCurrency(fee, meta)}).
          Остальное, {formatCurrency(pool, meta)}, распределяется между исполнителями. Часы посчитаны
          по средней ставке роли.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        {roles.map((role, index) => {
          const rate = averageRate[role.id] ?? 100_000;
          const hours = hoursFor(role.amount, rate);
          return (
            <div
              key={role.id}
              className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-6 ${
                index > 0 ? 'border-t border-line' : ''
              }`}
            >
              <div className="min-w-[9rem] flex-1">
                <p className="text-[0.9375rem] font-medium text-ink">{role.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{role.description}</p>
              </div>

              <div className="h-1.5 w-full min-w-[6rem] max-w-[10rem] flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(role.share * 100)}%` }}
                />
              </div>

              <div className="tnum shrink-0 text-right">
                <p className="text-[0.9375rem] font-semibold text-ink">
                  {formatCurrency(role.amount, meta)}
                </p>
                <p className="text-xs text-ink-muted">
                  ≈ {hours} {pluralize(hours, ['час', 'часа', 'часов'])}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BidRow({ bid, canAccept, onAccept, pending, onOpenProfile }) {
  const meta = useMeta();
  const developer = bid.developer;
  const role = developer ? ROLE_BY_ID[developer.role] : null;

  return (
    <motion.li
      layout
      className={`rounded-card border bg-surface p-5 ${
        bid.status === 'accepted'
          ? 'border-signal/40'
          : bid.status === 'declined'
            ? 'border-line opacity-55'
            : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => developer && onOpenProfile?.(developer)}
          disabled={!developer || !onOpenProfile}
          className="min-w-0 rounded-control text-left enabled:cursor-pointer"
        >
          <p className="text-[0.9375rem] font-semibold text-ink underline-offset-4 hover:underline">
            {developer?.full_name ?? 'Исполнитель'}
          </p>
          <p className="text-xs text-ink-muted">
            {role?.name ?? ''} · {developer?.city} · {developer?.projects_done} проектов ·{' '}
            <span className="text-brand">профиль и работы</span>
          </p>
        </button>
        <div className="tnum shrink-0 text-right">
          <p className="text-base font-semibold text-ink">{formatCurrency(bid.amount, meta)}</p>
          <p className="text-xs text-ink-muted">
            {bid.days} {pluralize(bid.days, ['день', 'дня', 'дней'])}
          </p>
        </div>
      </div>

      {bid.message && (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">{bid.message}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">
          {bid.status === 'accepted'
            ? 'Отклик принят'
            : bid.status === 'declined'
              ? 'Отклонён'
              : 'Ждёт вашего решения'}
        </span>
        {canAccept && bid.status === 'pending' && (
          <button
            type="button"
            onClick={() => onAccept(bid.id)}
            disabled={pending}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-brand px-4 text-[0.8125rem] font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
          >
            {pending && (
              <Loader2 size={ICON.xs} strokeWidth={STROKE.regular} className="animate-spin" />
            )}
            Принять отклик
          </button>
        )}
      </div>
    </motion.li>
  );
}

function BidForm({ project, developers }) {
  const meta = useMeta();
  const actingDevId = useHubStore((state) => state.actingDevId);
  const setActingDev = useHubStore((state) => state.setActingDev);
  const placeBid = useHubStore((state) => state.placeBid);
  const pendingAction = useHubStore((state) => state.pendingAction);

  const [amount, setAmount] = useState(String(project.budget));
  const [days, setDays] = useState('30');
  const [message, setMessage] = useState('');

  const developer = developers.find((dev) => dev.id === actingDevId) ?? developers[0];

  return (
    <form
      className="rounded-card border border-line bg-surface p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await placeBid({
          devId: developer?.id,
          amount: Number(amount),
          days: Number(days),
          message: message.trim(),
        });
        if (ok) setMessage('');
      }}
    >
      <p className="label-caps">Взять проект</p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
        Отправьте свою цену и срок. Заказчик выбирает один отклик — сумма сразу резервируется.
      </p>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="label-caps">Вы заходите как</span>
        <select
          value={developer?.id ?? ''}
          onChange={(event) => setActingDev(event.target.value)}
          className="min-h-11 cursor-pointer rounded-control border border-line bg-surface px-3 text-sm text-ink"
        >
          {developers.map((dev) => (
            <option key={dev.id} value={dev.id}>
              {dev.full_name} — {ROLE_BY_ID[dev.role]?.short ?? dev.role}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Ваша цена, сум</span>
          <input
            type="number"
            min="0"
            step="100000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="tnum min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Срок, дней</span>
          <input
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="tnum min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="label-caps">Комментарий</span>
        <textarea
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Что именно возьмёте и почему справитесь в этот срок."
          className="rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70"
        />
      </label>

      <p className="tnum mt-3 text-xs text-ink-muted">
        При этой цене на руки после комиссии:{' '}
        <span className="font-medium text-ink-soft">
          {formatCurrency(Math.round(Number(amount || 0) * (1 - PLATFORM_FEE_RATE)), meta)}
        </span>
      </p>

      <button
        type="submit"
        disabled={pendingAction === 'bid'}
        className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
      >
        {pendingAction === 'bid' ? (
          <Loader2 size={ICON.sm} strokeWidth={STROKE.regular} className="animate-spin" />
        ) : (
          <Handshake size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
        )}
        Откликнуться на проект
      </button>
    </form>
  );
}

function Timeline({ events }) {
  const meta = useMeta();
  if (!events?.length) return null;
  return (
    <div className="mt-6 rounded-card border border-line bg-surface px-5 py-5">
      <p className="label-caps">История</p>
      <ol className="mt-3 flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
            />
            <div className="min-w-0">
              <p className="text-[0.8125rem] leading-relaxed text-ink-soft">{event.message}</p>
              <p className="tnum mt-0.5 text-xs text-ink-muted">
                {formatDateTime(event.created_at, meta.locale)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ProjectHub({ onBack }) {
  const template = useTemplate();
  const reduce = useReducedMotion();

  const project = useHubStore((state) => state.project);
  const bids = useHubStore((state) => state.bids);
  const deal = useHubStore((state) => state.deal);
  const events = useHubStore((state) => state.events);
  const developers = useHubStore((state) => state.developers);
  const loading = useHubStore((state) => state.loading);
  const error = useHubStore((state) => state.error);
  const pendingAction = useHubStore((state) => state.pendingAction);
  const viewer = useHubStore((state) => state.viewer);
  const actingDevId = useHubStore((state) => state.actingDevId);
  const refresh = useHubStore((state) => state.refresh);
  const acceptBid = useHubStore((state) => state.acceptBid);
  const closeDeal = useHubStore((state) => state.closeDeal);
  const refreshBids = useHubStore((state) => state.refreshBids);
  const setViewer = useHubStore((state) => state.setViewer);
  const accountRole = useAuthStore((state) => state.role);

  const [profileDev, setProfileDev] = useState(null);
  const formRef = useRef(null);

  const averageRating = useMemo(() => {
    if (!developers.length) return 4.8;
    const sum = developers.reduce((total, dev) => total + (Number(dev.rating) || 0), 0);
    return Math.round((sum / developers.length) * 10) / 10;
  }, [developers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Роль выбрана при регистрации — доска сразу открывается нужной стороной.
  useEffect(() => {
    if (accountRole === 'client' || accountRole === 'developer') setViewer(accountRole);
  }, [accountRole, setViewer]);

  const profileModal = (
    <DeveloperProfile developer={profileDev} onClose={() => setProfileDev(null)} />
  );

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-10 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
          К предложению
        </button>

        <div className="mt-8">
          <HubHero
            developers={developers}
            averageRating={averageRating}
            onStart={() =>
              formRef.current?.scrollIntoView({
                behavior: reduce ? 'auto' : 'smooth',
                block: 'start',
              })
            }
          />
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-ink-muted">Загружаю доску…</p>
        ) : (
          <motion.div
            ref={formRef}
            id="new-task"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mt-14 scroll-mt-24"
          >
            <NewProjectForm />
          </motion.div>
        )}

        {developers.length > 0 && (
          <DeveloperBoard developers={developers} onOpen={setProfileDev} />
        )}

        {profileModal}
      </main>
    );
  }

  const isClient = viewer === 'client';
  const openForBids = project.status === 'open';

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-10 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />К предложению
        </button>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Роль"
            className="flex items-center gap-1 rounded-full border border-line bg-surface p-1"
          >
            {[
              { id: 'client', label: 'Я заказчик' },
              { id: 'developer', label: 'Я исполнитель' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={viewer === tab.id}
                onClick={() => setViewer(tab.id)}
                className={`min-h-9 cursor-pointer rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
                  viewer === tab.id ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(project.status === 'completed' || project.status === 'archived' || !deal) && (
            <button
              type="button"
              onClick={closeDeal}
              disabled={pendingAction === 'close'}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[0.8125rem] font-medium text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:opacity-45"
            >
              <Plus size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
              {deal ? 'Выйти и создать новую' : 'Новая задача'}
            </button>
          )}

          <button
            type="button"
            onClick={refresh}
            aria-label="Обновить"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:text-ink"
          >
            <RefreshCw
              size={ICON.sm}
              strokeWidth={STROKE.regular}
              className={loading ? 'animate-spin' : undefined}
            />
          </button>
        </div>
      </div>

      <header className="mt-8">
        <p className="label-caps">Центр проектов · {template.meta.studio.name}</p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
          Проект опубликован для исполнителей
        </h1>
        <p className="measure mt-3 text-[1.0625rem] leading-relaxed text-ink-soft">
          {isClient
            ? 'Выберите исполнителя, который возьмёт работу. Деньги резервируются площадкой и уходят ему только после того, как вы примете результат.'
            : 'Возьмите проект: отправьте цену и срок. После приёмки заказчиком сумма за вычетом комиссии придёт вам.'}
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-control border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-x-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <ProjectCard project={project} />

          <BudgetBreakdown project={project} developers={developers} />

          <section aria-labelledby="bids-heading" className="mt-12">
            <div className="flex flex-col gap-3 border-t border-line pt-8">
              <p className="label-caps">Отклики</p>
              <h2
                id="bids-heading"
                className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]"
              >
                {bids.length > 0
                  ? `${bids.length} ${pluralize(bids.length, ['отклик', 'отклика', 'откликов'])} на проект`
                  : 'Откликов пока нет'}
              </h2>
            </div>

            {openForBids && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={refreshBids}
                  disabled={pendingAction === 'rebid'}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-4 text-[0.8125rem] font-semibold text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink disabled:opacity-45"
                >
                  {pendingAction === 'rebid' ? (
                    <Loader2 size={ICON.xs} strokeWidth={STROKE.regular} className="animate-spin" />
                  ) : (
                    <RefreshCw size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
                  )}
                  Запросить новые цены
                </button>
                <span className="text-xs text-ink-muted">
                  Исполнители пересчитают предложение под вашу задачу.
                </span>
              </div>
            )}

            {!isClient && openForBids && (
              <div className="mt-6">
                <BidForm project={project} developers={developers} />
              </div>
            )}

            <motion.ul layout className="mt-5 flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {bids.map((bid) => (
                  <BidRow
                    key={bid.id}
                    bid={bid}
                    canAccept={isClient && openForBids}
                    onAccept={acceptBid}
                    onOpenProfile={setProfileDev}
                    pending={pendingAction === `accept:${bid.id}`}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          </section>

          <DeveloperBoard
            developers={developers}
            onOpen={setProfileDev}
            footerFor={
              isClient
                ? null
                : (developer) => (
                    <span className="text-xs text-ink-muted">
                      {developer.id === actingDevId ? 'это вы' : ''}
                    </span>
                  )
            }
          />
        </div>

        <aside className="mt-12 lg:mt-0" aria-label="Сделка">
          <div className="lg:sticky lg:top-24">
            <DealPanel deal={deal} viewer={viewer} onOpenProfile={setProfileDev} />
            <Timeline events={events} />

            <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-muted">
              <Users
                size={ICON.xs}
                strokeWidth={STROKE.regular}
                aria-hidden="true"
                className="mt-[0.15rem] shrink-0"
              />
              {developers.length} исполнителей в базе. Ставки — уровень рынка Узбекистана 2026.
            </p>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {loading && !reduce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed bottom-6 right-6 z-40 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white"
          >
            Обновляю…
          </motion.div>
        )}
      </AnimatePresence>

      {profileModal}
    </main>
  );
}
