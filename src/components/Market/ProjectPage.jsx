import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  MessagesSquare,
  Pencil,
  Send,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate, toHref } from '../../lib/router';
import ProjectForm from './ProjectForm';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Input,
  ModerationBadge,
  Rating,
  Spinner,
  StatusBadge,
  TagPill,
  TextArea,
  money,
  moneyShort,
  plural,
  timeAgo,
} from './ui';

/**
 * Карточка проекта — здесь сходятся все роли.
 *
 * Кнопки рисуются по `permissions`, которые прислал сервер, а не по догадке
 * фронтенда. Даже если разметку подменить в браузере, действие всё равно
 * упрётся в проверку прав на бэкенде: автор или администратор.
 */

/* ------------------------------------------------------------------ */
/* Отклики                                                             */
/* ------------------------------------------------------------------ */

function BidForm({ project, onSent }) {
  const placeBid = useMarketStore((state) => state.placeBid);
  const [amount, setAmount] = useState(String(project.budgetMax || ''));
  const [days, setDays] = useState(String(project.deadlineDays || ''));
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!Number(amount) || !Number(days)) {
      setError('Укажите сумму и срок — без них отклик не отправить.');
      return;
    }
    setPending(true);
    try {
      await placeBid(project.id, {
        amount: Number(amount),
        days: Number(days),
        message: message.trim() || null,
      });
      setPending(false);
      setMessage('');
      if (onSent) onSent();
    } catch (sendError) {
      setPending(false);
      setError(sendError?.message ?? 'Не удалось отправить отклик.');
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-[0.9375rem] font-semibold text-ink">Ваш отклик</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Назовите свою цену и срок. Заказчик увидит их вместе с вашим профилем и рейтингом.
      </p>
      <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
        <Alert tone="error">{error}</Alert>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            id="bid-amount"
            label="Сумма, сум"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="tnum"
          />
          <Input
            id="bid-days"
            label="Срок, дней"
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="tnum"
          />
        </div>
        <TextArea
          id="bid-message"
          label="Комментарий"
          rows={4}
          placeholder="Что уже делали похожего, как планируете вести работу, что нужно от заказчика."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button type="submit" pending={pending} className="w-fit">
          Отправить отклик
        </Button>
      </form>
    </Card>
  );
}

function BidRow({ bid, project, permissions, currentUser }) {
  const acceptBid = useMarketStore((state) => state.acceptBid);
  const withdrawBid = useMarketStore((state) => state.withdrawBid);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const mine = currentUser?.id === bid.devId;
  const canAccept = permissions.canEdit && project.status === 'open' && bid.status === 'pending';

  const act = async (action) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError?.message ?? 'Действие не выполнено.');
    }
    setPending(false);
  };

  return (
    <li className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar user={bid.developer} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={toHref(`/users/${bid.devId}`)}
              className="text-[0.9375rem] font-semibold text-ink underline-offset-4 hover:underline"
            >
              {bid.developer?.fullName || 'Исполнитель площадки'}
            </a>
            {bid.developer?.level && (
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                {bid.developer.level}
              </span>
            )}
            {bid.status === 'accepted' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-signal-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-signal ring-1 ring-signal/20">
                <CheckCircle2 size={11} strokeWidth={2.2} aria-hidden="true" />
                Выбран
              </span>
            )}
            {bid.status === 'declined' && (
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-ink-muted">
                Отклонён
              </span>
            )}
            {mine && (
              <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-brand">
                Ваш отклик
              </span>
            )}
          </div>

          {bid.developer?.headline && (
            <p className="mt-0.5 text-xs text-ink-muted">{bid.developer.headline}</p>
          )}
          <div className="mt-1">
            <Rating value={bid.developer?.rating} count={bid.developer?.reviewsCount} size={12} />
          </div>

          {bid.message && (
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{bid.message}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="tnum text-[0.9375rem] font-semibold text-ink">
              {money(bid.amount, project.currency)}
            </span>
            <span className="tnum inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Clock3 size={13} strokeWidth={1.7} aria-hidden="true" />
              {bid.days} {plural(bid.days, ['день', 'дня', 'дней'])}
            </span>
            <span className="text-xs text-ink-muted">{timeAgo(bid.createdAt)}</span>
          </div>

          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {canAccept && (
              <Button size="sm" pending={pending} onClick={() => act(() => acceptBid(project.id, bid.id))}>
                Выбрать исполнителя
              </Button>
            )}
            {mine && bid.status === 'pending' && (
              <Button
                tone="ghost"
                size="sm"
                pending={pending}
                onClick={() => act(() => withdrawBid(project.id, bid.id))}
              >
                Отозвать отклик
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Переписка                                                           */
/* ------------------------------------------------------------------ */

function Thread({ projectId, currentUser }) {
  const messages = useMarketStore((state) => state.messages);
  const loadMessages = useMarketStore((state) => state.loadMessages);
  const sendMessage = useMarketStore((state) => state.sendMessage);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    loadMessages(projectId);
  }, [projectId, loadMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPending(true);
    setError(null);
    try {
      await sendMessage(projectId, body);
      setDraft('');
    } catch (sendError) {
      setError(sendError?.message ?? 'Сообщение не отправилось.');
    }
    setPending(false);
  };

  return (
    <Card className="flex flex-col p-5">
      <h3 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
        <MessagesSquare size={16} strokeWidth={1.7} className="text-ink-muted" aria-hidden="true" />
        Переписка по проекту
      </h3>

      <div className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted">
            Сообщений пока нет. Здесь видно всё, о чём договорились, — история остаётся у обеих сторон.
          </p>
        )}
        {messages.map((item) => {
          const own = item.authorId === currentUser?.id;
          return (
            <div key={item.id} className={`flex gap-2.5 ${own ? 'flex-row-reverse' : ''}`}>
              <Avatar user={item.author} size={30} />
              <div className={`min-w-0 max-w-[80%] ${own ? 'text-right' : ''}`}>
                <p className="text-xs text-ink-muted">
                  {item.author?.fullName || 'Участник'} · {timeAgo(item.createdAt)}
                </p>
                <p
                  className={`mt-1 inline-block whitespace-pre-wrap rounded-card px-3.5 py-2 text-left text-sm leading-relaxed ${
                    own ? 'bg-brand text-white' : 'bg-surface-sunken text-ink-soft'
                  }`}
                >
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form className="mt-4 flex flex-col gap-2" onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Написать сообщение"
            aria-label="Текст сообщения"
            className="min-h-11 flex-1 rounded-control border border-line-strong bg-surface px-3.5 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-brand"
          />
          <Button type="submit" pending={pending} aria-label="Отправить">
            <Send size={15} strokeWidth={1.9} aria-hidden="true" />
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Отзыв                                                               */
/* ------------------------------------------------------------------ */

function ReviewBlock({ project, reviews, currentUser }) {
  const leaveReview = useMarketStore((state) => state.leaveReview);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const participant = currentUser
    ? currentUser.id === project.ownerId || currentUser.id === project.assigneeId
    : false;
  const already = reviews.some((review) => review.authorId === currentUser?.id);

  if (project.status !== 'completed' || !participant) return null;

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await leaveReview(project.id, { rating, comment: comment.trim() || null });
      setComment('');
    } catch (reviewError) {
      setError(reviewError?.message ?? 'Отзыв не сохранился.');
    }
    setPending(false);
  };

  return (
    <Card className="p-5">
      <h3 className="text-[0.9375rem] font-semibold text-ink">
        {already ? 'Ваш отзыв сохранён' : 'Оцените вторую сторону'}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Оценка попадает в рейтинг профиля и видна всем на площадке.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        <Alert tone="error">{error}</Alert>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Оценка">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} из 5`}
              onClick={() => setRating(value)}
              className="cursor-pointer rounded p-1"
            >
              <Star
                size={22}
                strokeWidth={1.6}
                className={value <= rating ? 'fill-amber-400 text-amber-400' : 'text-line-strong'}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <TextArea
          id="review-comment"
          rows={3}
          placeholder="Что получилось хорошо, что можно было лучше."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <Button type="submit" pending={pending} className="w-fit">
          {already ? 'Обновить отзыв' : 'Оставить отзыв'}
        </Button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Страница                                                            */
/* ------------------------------------------------------------------ */

export default function ProjectPage({ projectId }) {
  const user = useAuthStore((state) => state.user);
  const meta = useMarketStore((state) => state.meta);
  const payload = useMarketStore((state) => state.project);
  const loading = useMarketStore((state) => state.projectLoading);
  const error = useMarketStore((state) => state.projectError);
  const loadProject = useMarketStore((state) => state.loadProject);
  const changeStatus = useMarketStore((state) => state.changeStatus);
  const removeProject = useMarketStore((state) => state.removeProject);

  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadProject(projectId);
    setEditing(false);
  }, [projectId, loadProject]);

  if (loading && !payload) return <Spinner label="Открываю проект" />;
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-5 py-16">
        <Alert tone="error">{error}</Alert>
        <Button tone="secondary" className="mt-4" onClick={() => navigate('/projects')}>
          Вернуться к доске
        </Button>
      </div>
    );
  }
  if (!payload) return null;

  const { project, bids, bidsHidden, events, reviews, permissions } = payload;
  const category = (meta?.categories ?? []).find((item) => item.id === project.category);
  const alreadyBid = bids.some((bid) => bid.devId === user?.id);
  const isParticipant =
    user && (user.id === project.ownerId || user.id === project.assigneeId || alreadyBid || user.isAdmin);

  const run = async (action) => {
    setActionError(null);
    try {
      await action();
    } catch (runError) {
      setActionError(runError?.message ?? 'Действие не выполнено.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <a
        href={toHref('/projects')}
        className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
        Все задачи
      </a>

      {editing ? (
        <div className="mt-5 max-w-[820px]">
          <ProjectForm
            project={project}
            onDone={async (saved) => {
              setEditing(false);
              if (saved) await loadProject(project.id);
            }}
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ------------------------------------------------ основное */}
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={project.status} />
                <ModerationBadge moderation={project.moderation} />
                {category && (
                  <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
                    {category.label}
                  </span>
                )}
                {project.level && (
                  <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
                    уровень: {project.level}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-muted">{timeAgo(project.createdAt)}</span>
              </div>

              <h1 className="mt-3 text-[1.625rem] font-semibold leading-snug tracking-[-0.025em] text-ink sm:text-[2rem]">
                {project.title}
              </h1>

              {project.moderationNote && (
                <Alert tone="error" className="mt-4">
                  Комментарий модератора: {project.moderationNote}
                </Alert>
              )}

              <p className="measure mt-4 whitespace-pre-wrap text-[1.0625rem] leading-relaxed text-ink-soft">
                {project.description}
              </p>

              {project.tags?.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <TagPill key={tag}>{tag}</TagPill>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
                <span className="tnum inline-flex items-center gap-1.5 text-[1.0625rem] font-semibold text-ink">
                  <Wallet size={17} strokeWidth={1.7} className="text-ink-muted" aria-hidden="true" />
                  {project.budgetMin && project.budgetMin !== project.budgetMax
                    ? `${moneyShort(project.budgetMin)} — ${moneyShort(project.budgetMax)}`
                    : moneyShort(project.budgetMax)}
                </span>
                {project.deadlineDays ? (
                  <span className="tnum inline-flex items-center gap-1.5 text-sm text-ink-muted">
                    <Clock3 size={14} strokeWidth={1.7} aria-hidden="true" />
                    срок до {project.deadlineDays} {plural(project.deadlineDays, ['дня', 'дней', 'дней'])}
                  </span>
                ) : null}
                <span className="tnum inline-flex items-center gap-1.5 text-sm text-ink-muted">
                  <Eye size={14} strokeWidth={1.7} aria-hidden="true" />
                  {project.views}
                </span>
              </div>

              {actionError && <Alert tone="error" className="mt-4">{actionError}</Alert>}

              {(permissions.canEdit || permissions.canDelete) && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                  {permissions.canEdit && (
                    <Button tone="secondary" size="sm" onClick={() => setEditing(true)}>
                      <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
                      Редактировать
                    </Button>
                  )}
                  {permissions.canEdit && project.status === 'in_progress' && (
                    <Button
                      tone="signal"
                      size="sm"
                      onClick={() => run(() => changeStatus(project.id, 'completed'))}
                    >
                      <CheckCircle2 size={14} strokeWidth={1.9} aria-hidden="true" />
                      Принять работу
                    </Button>
                  )}
                  {permissions.canEdit && project.status !== 'completed' && project.status !== 'cancelled' && (
                    <Button
                      tone="ghost"
                      size="sm"
                      onClick={() => run(() => changeStatus(project.id, 'cancelled'))}
                    >
                      Отменить проект
                    </Button>
                  )}
                  {permissions.canDelete && (
                    <Button
                      tone="danger"
                      size="sm"
                      onClick={() =>
                        confirmDelete
                          ? run(async () => {
                              await removeProject(project.id);
                              navigate('/projects');
                            })
                          : setConfirmDelete(true)
                      }
                    >
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                      {confirmDelete ? 'Точно удалить?' : 'Удалить'}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {permissions.canBid && !alreadyBid && <BidForm project={project} />}

            {(bids.length > 0 || bidsHidden > 0) && (
              <section aria-labelledby="bids-heading">
                <h2 id="bids-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
                  Отклики
                  {bids.length > 0 && (
                    <span className="tnum ml-2 text-sm font-normal text-ink-muted">{bids.length}</span>
                  )}
                </h2>
                {bidsHidden > 0 && (
                  <p className="mt-1.5 text-sm text-ink-muted">
                    Ещё {bidsHidden} {plural(bidsHidden, ['отклик', 'отклика', 'откликов'])} — их видит
                    только заказчик.
                  </p>
                )}
                <ul className="mt-4 flex flex-col gap-3">
                  {bids.map((bid) => (
                    <BidRow
                      key={bid.id}
                      bid={bid}
                      project={project}
                      permissions={permissions}
                      currentUser={user}
                    />
                  ))}
                </ul>
              </section>
            )}

            {isParticipant && <Thread projectId={project.id} currentUser={user} />}
            <ReviewBlock project={project} reviews={reviews} currentUser={user} />
          </div>

          {/* ------------------------------------------------ боковая */}
          <aside className="flex flex-col gap-4">
            {project.owner && (
              <Card className="p-5">
                <p className="label-caps">Заказчик</p>
                <a href={toHref(`/users/${project.ownerId}`)} className="mt-3 flex items-center gap-3">
                  <Avatar user={project.owner} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                      {project.owner.fullName || 'Заказчик площадки'}
                    </span>
                    {project.owner.company && (
                      <span className="block truncate text-xs text-ink-muted">{project.owner.company}</span>
                    )}
                    <Rating value={project.owner.rating} count={project.owner.reviewsCount} size={12} />
                  </span>
                </a>
              </Card>
            )}

            {project.assignee && (
              <Card className="p-5">
                <p className="label-caps">Исполнитель</p>
                <a href={toHref(`/users/${project.assigneeId}`)} className="mt-3 flex items-center gap-3">
                  <Avatar user={project.assignee} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                      {project.assignee.fullName || 'Исполнитель'}
                    </span>
                    {project.assignee.headline && (
                      <span className="block truncate text-xs text-ink-muted">{project.assignee.headline}</span>
                    )}
                    <Rating value={project.assignee.rating} count={project.assignee.reviewsCount} size={12} />
                  </span>
                </a>
                {project.agreedAmount ? (
                  <p className="tnum mt-4 border-t border-line pt-4 text-sm text-ink-soft">
                    Сумма сделки:{' '}
                    <span className="font-semibold text-ink">{money(project.agreedAmount, project.currency)}</span>
                  </p>
                ) : null}
              </Card>
            )}

            <Card className="p-5">
              <p className="label-caps">Что происходило</p>
              <ol className="mt-4 flex flex-col gap-3.5">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm leading-relaxed text-ink-soft">{event.message}</span>
                      <span className="block text-xs text-ink-muted">{timeAgo(event.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
