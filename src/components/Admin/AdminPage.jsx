import { useEffect, useState } from 'react';
import {
  Ban,
  Eye,
  EyeOff,
  Layers,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminStore } from '../../store/useAdminStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate, toHref } from '../../lib/router';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Spinner,
  StatusBadge,
  TextArea,
  formatDate,
  moneyShort,
  timeAgo,
} from '../Market/ui';

/**
 * Админ-панель.
 *
 * Разделена по задачам, а не по таблицам: «кто у нас есть», «что опубликовано»,
 * «что показываем на главной». Опасные действия (удаление, блокировка) требуют
 * второго клика — панель не должна быть местом, где промах стоит аккаунта.
 */

const TABS = [
  { id: 'overview', label: 'Сводка', icon: Layers },
  { id: 'users', label: 'Пользователи', icon: Users },
  { id: 'projects', label: 'Проекты', icon: ScrollText },
  { id: 'offers', label: 'Предложения', icon: Shield },
];

/* ------------------------------------------------------------------ */
/* Сводка                                                              */
/* ------------------------------------------------------------------ */

function Overview() {
  const overview = useAdminStore((state) => state.overview);
  const loading = useAdminStore((state) => state.loading);
  const load = useAdminStore((state) => state.loadOverview);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !overview) return <Spinner label="Собираю сводку" />;
  if (!overview) return null;

  const tiles = [
    { label: 'Всего аккаунтов', value: overview.users.total },
    { label: 'Заказчиков', value: overview.users.clients },
    { label: 'Программистов', value: overview.users.developers },
    { label: 'Администраторов', value: overview.users.admins },
    { label: 'Заблокировано', value: overview.users.blocked },
    { label: 'Проектов', value: overview.market.projects },
    { label: 'В поиске', value: overview.market.open },
    { label: 'В работе', value: overview.market.inProgress },
    { label: 'Завершено', value: overview.market.completed },
    { label: 'Скрыто модерацией', value: overview.market.hidden },
    { label: 'Откликов', value: overview.market.bids },
    { label: 'Отзывов', value: overview.market.reviews },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-5">
        <p className="label-caps">Суперадминистратор</p>
        <p className="mt-2 text-[0.9375rem] text-ink">
          {overview.owner.email}
          {overview.owner.isYou && (
            <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              это вы
            </span>
          )}
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Аккаунт с этой почтой получает полный доступ автоматически. Его нельзя заблокировать,
          удалить или разжаловать — ни из панели, ни запросом к API.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="px-4 py-3.5">
            <p className="text-xs text-ink-muted">{tile.label}</p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">{tile.value}</p>
          </Card>
        ))}
      </div>

      <section>
        <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">Журнал действий</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Каждое административное действие записывается — кто, что и когда.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {overview.log.length ? (
            overview.log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-control border border-line bg-surface px-4 py-2.5"
              >
                <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-ink-soft">
                  {entry.action}
                </code>
                <span className="text-sm text-ink">{entry.target ?? '—'}</span>
                <span className="ml-auto text-xs text-ink-muted">
                  {entry.actor_email} · {timeAgo(entry.created_at)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-sm text-ink-muted">Пока ничего не происходило.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Пользователи                                                        */
/* ------------------------------------------------------------------ */

function UserRow({ row, isOwnerViewer, currentUserId }) {
  const blockUser = useAdminStore((state) => state.blockUser);
  const deleteUser = useAdminStore((state) => state.deleteUser);
  const setAdmin = useAdminStore((state) => state.setAdmin);
  const setRole = useAdminStore((state) => state.setRole);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');

  const protectedRow = row.isOwner || row.id === currentUserId;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          <Avatar user={row} size={32} />
          <div className="min-w-0">
            <a
              href={toHref(`/users/${row.id}`)}
              className="block truncate text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              {row.fullName || '—'}
            </a>
            <span className="block truncate text-xs text-ink-muted">{row.email}</span>
          </div>
        </div>
      </td>

      <td className="py-3 pr-3">
        <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
          {row.role === 'developer' ? 'Программист' : 'Заказчик'}
        </span>
        {row.sphere && <span className="ml-1.5 text-xs text-ink-muted">{row.sphere}</span>}
        {row.level && <span className="ml-1 text-xs text-ink-muted">· {row.level}</span>}
      </td>

      <td className="py-3 pr-3">
        <div className="flex flex-wrap gap-1.5">
          {row.isOwner && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              Суперадмин
            </span>
          )}
          {row.isAdmin && !row.isOwner && (
            <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-brand">
              Админ
            </span>
          )}
          {row.isBlocked && (
            <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-danger">
              Заблокирован
            </span>
          )}
          {!row.emailVerified && (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-ink-muted">
              Почта не подтверждена
            </span>
          )}
        </div>
      </td>

      <td className="tnum py-3 pr-3 text-xs text-ink-muted">{formatDate(row.createdAt)}</td>

      <td className="py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          {isOwnerViewer && !row.isOwner && (
            <Button
              tone={row.isAdmin ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => setAdmin(row.id, !row.isAdmin)}
            >
              <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" />
              {row.isAdmin ? 'Забрать админа' : 'Сделать админом'}
            </Button>
          )}

          {isOwnerViewer && !row.isOwner && (
            <Select
              id={`role-${row.id}`}
              value={row.role}
              onChange={(event) => setRole(row.id, event.target.value)}
              options={[
                { id: 'client', label: 'Заказчик' },
                { id: 'developer', label: 'Программист' },
              ]}
              className="min-h-9 w-36 text-[0.8125rem]"
              aria-label="Сменить роль"
            />
          )}

          {!protectedRow && (
            <Button
              tone={row.isBlocked ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => blockUser(row.id, !row.isBlocked, reason || null)}
            >
              <Ban size={13} strokeWidth={1.8} aria-hidden="true" />
              {row.isBlocked ? 'Разблокировать' : 'Заблокировать'}
            </Button>
          )}

          {!protectedRow && (
            <Button
              tone="danger"
              size="sm"
              onClick={() => (confirm ? deleteUser(row.id) : setConfirm(true))}
            >
              <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
              {confirm ? 'Точно?' : 'Удалить'}
            </Button>
          )}
        </div>

        {!protectedRow && !row.isBlocked && (
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="причина блокировки"
            aria-label="Причина блокировки"
            className="mt-1.5 min-h-8 w-full rounded-control border border-line bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand"
          />
        )}
      </td>
    </tr>
  );
}

function UsersTab() {
  const user = useAuthStore((state) => state.user);
  const users = useAdminStore((state) => state.users);
  const total = useAdminStore((state) => state.usersTotal);
  const query = useAdminStore((state) => state.userQuery);
  const setQuery = useAdminStore((state) => state.setUserQuery);
  const load = useAdminStore((state) => state.loadUsers);
  const loading = useAdminStore((state) => state.loading);
  const [search, setSearch] = useState(query.search);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== query.search) setQuery('search', search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, query.search, setQuery]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Почта или имя"
            aria-label="Поиск пользователей"
            className="min-h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-3.5 text-[0.9375rem] text-ink outline-none focus:border-brand"
          />
        </label>
        <Select
          id="admin-role-filter"
          value={query.role}
          onChange={(event) => setQuery('role', event.target.value)}
          options={[
            { id: 'client', label: 'Заказчики' },
            { id: 'developer', label: 'Программисты' },
          ]}
          placeholder="Все роли"
          className="sm:w-52"
          aria-label="Фильтр по роли"
        />
      </div>

      <p className="text-sm text-ink-muted">Найдено: {total}</p>

      {loading && !users.length ? (
        <Spinner label="Загружаю пользователей" />
      ) : users.length ? (
        <Card className="overflow-x-auto p-5">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="label-caps pb-2 pr-3 font-semibold">Аккаунт</th>
                <th className="label-caps pb-2 pr-3 font-semibold">Роль</th>
                <th className="label-caps pb-2 pr-3 font-semibold">Статус</th>
                <th className="label-caps pb-2 pr-3 font-semibold">Регистрация</th>
                <th className="label-caps pb-2 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <UserRow
                  key={row.id}
                  row={row}
                  isOwnerViewer={user?.isOwner === true}
                  currentUserId={user?.id}
                />
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Empty icon={Users} title="Никого не нашлось" hint="Попробуйте другой запрос или снимите фильтр." />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Проекты                                                             */
/* ------------------------------------------------------------------ */

function ProjectsTab() {
  const projects = useAdminStore((state) => state.projects);
  const total = useAdminStore((state) => state.projectsTotal);
  const query = useAdminStore((state) => state.projectQuery);
  const setQuery = useAdminStore((state) => state.setProjectQuery);
  const load = useAdminStore((state) => state.loadProjects);
  const moderate = useAdminStore((state) => state.moderate);
  const remove = useAdminStore((state) => state.deleteProject);
  const loading = useAdminStore((state) => state.loading);
  const meta = useMarketStore((state) => state.meta);
  const [note, setNote] = useState({});
  const [confirm, setConfirm] = useState({});

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="admin-project-search"
          placeholder="Поиск по названию и описанию"
          value={query.search}
          onChange={(event) => setQuery('search', event.target.value)}
          className="flex-1"
          aria-label="Поиск проектов"
        />
        <Select
          id="admin-project-status"
          value={query.status}
          onChange={(event) => setQuery('status', event.target.value)}
          options={meta?.statuses ?? []}
          placeholder="Любой статус"
          className="sm:w-52"
          aria-label="Фильтр по статусу"
        />
      </div>

      <p className="text-sm text-ink-muted">Всего: {total}</p>

      {loading && !projects.length ? (
        <Spinner label="Загружаю проекты" />
      ) : projects.length ? (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={toHref(`/projects/${project.id}`)}
                      className="text-[0.9375rem] font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {project.title}
                    </a>
                    <p className="tnum mt-1 text-xs text-ink-muted">
                      {project.owner?.email ?? '—'} · {moneyShort(project.budgetMax, project.currency)} ·{' '}
                      {project.bidsCount} откл. · {project.views} просм. · {timeAgo(project.createdAt)}
                    </p>
                    {project.moderationNote && (
                      <p className="mt-1.5 text-xs text-danger">Заметка: {project.moderationNote}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        project.moderation === 'published'
                          ? 'bg-signal-tint text-signal'
                          : 'bg-danger-tint text-danger'
                      }`}
                    >
                      {project.moderation === 'published'
                        ? 'Опубликован'
                        : project.moderation === 'hidden'
                          ? 'Скрыт'
                          : 'На доработке'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {project.moderation === 'published' ? (
                    <>
                      <input
                        value={note[project.id] ?? ''}
                        onChange={(event) => setNote({ ...note, [project.id]: event.target.value })}
                        placeholder="причина скрытия"
                        aria-label="Причина скрытия"
                        className="min-h-9 flex-1 rounded-control border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-brand sm:max-w-xs"
                      />
                      <Button
                        tone="secondary"
                        size="sm"
                        onClick={() => moderate(project.id, 'hidden', note[project.id] ?? null)}
                      >
                        <EyeOff size={13} strokeWidth={1.8} aria-hidden="true" />
                        Снять с публикации
                      </Button>
                    </>
                  ) : (
                    <Button tone="secondary" size="sm" onClick={() => moderate(project.id, 'published', null)}>
                      <Eye size={13} strokeWidth={1.8} aria-hidden="true" />
                      Вернуть в выдачу
                    </Button>
                  )}
                  <Button
                    tone="danger"
                    size="sm"
                    onClick={() =>
                      confirm[project.id] ? remove(project.id) : setConfirm({ ...confirm, [project.id]: true })
                    }
                  >
                    <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                    {confirm[project.id] ? 'Точно удалить?' : 'Удалить'}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={ScrollText} title="Проектов нет" hint="Как только появится первая задача, она будет здесь." />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Предложения                                                         */
/* ------------------------------------------------------------------ */

function OffersTab() {
  const offers = useAdminStore((state) => state.offers);
  const load = useAdminStore((state) => state.loadOffers);
  const create = useAdminStore((state) => state.createOffer);
  const toggle = useAdminStore((state) => state.toggleOffer);
  const remove = useAdminStore((state) => state.deleteOffer);
  const loading = useAdminStore((state) => state.loading);

  const [draft, setDraft] = useState({ title: '', subtitle: '', body: '', ctaLabel: '', ctaHref: '', weight: 1 });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    const ok = await create({ ...draft, weight: Number(draft.weight) || 1 });
    setPending(false);
    if (ok) setDraft({ title: '', subtitle: '', body: '', ctaLabel: '', ctaHref: '', weight: 1 });
  };

  const currentIds = new Set((offers.current?.offers ?? []).map((offer) => offer.id));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {offers.current && (
          <Card className="p-5">
            <p className="label-caps">Показывается сейчас</p>
            <p className="mt-1.5 text-sm text-ink-muted">
              Окно №{offers.current.cycle} · до {formatDate(offers.current.endsAt)} · ротация раз в{' '}
              {offers.current.rotationDays} дн.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(offers.current.offers ?? []).map((offer) => (
                <li
                  key={offer.id}
                  className="rounded-full bg-brand-tint px-3 py-1.5 text-xs font-medium text-brand"
                >
                  {offer.title}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">Пул предложений</h3>

        {loading && !offers.pool.length ? (
          <Spinner label="Загружаю пул" />
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.pool.map((offer) => (
              <li key={offer.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{offer.title}</p>
                        {currentIds.has(offer.id) && (
                          <span className="rounded-full bg-signal-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-signal">
                            в эфире
                          </span>
                        )}
                        {!offer.active && (
                          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-ink-muted">
                            выключено
                          </span>
                        )}
                      </div>
                      {offer.body && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{offer.body}</p>
                      )}
                      <p className="tnum mt-1 text-xs text-ink-muted">
                        вес {offer.weight} · {offer.slug}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button tone="ghost" size="sm" onClick={() => toggle(offer.id, !offer.active)}>
                        {offer.active ? 'Выключить' : 'Включить'}
                      </Button>
                      <Button tone="danger" size="sm" onClick={() => remove(offer.id)}>
                        <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside>
        <Card className="p-5">
          <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">Новое предложение</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Попадёт в пул ротации. Чем больше вес, тем чаще оно выпадает в подборку.
          </p>
          <form className="mt-4 flex flex-col gap-3.5" onSubmit={submit}>
            <Input id="offer-title" label="Заголовок" value={draft.title} onChange={set('title')} required />
            <Input id="offer-subtitle" label="Надзаголовок" value={draft.subtitle} onChange={set('subtitle')} />
            <TextArea id="offer-body" label="Текст" rows={4} value={draft.body} onChange={set('body')} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="offer-cta" label="Кнопка" value={draft.ctaLabel} onChange={set('ctaLabel')} />
              <Input id="offer-href" label="Ссылка" value={draft.ctaHref} onChange={set('ctaHref')} />
            </div>
            <Input
              id="offer-weight"
              label="Вес (1–10)"
              inputMode="numeric"
              value={draft.weight}
              onChange={set('weight')}
              className="tnum"
            />
            <Button type="submit" pending={pending} className="w-fit">
              Добавить в пул
            </Button>
          </form>
        </Card>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница                                                            */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const tab = useAdminStore((state) => state.tab);
  const setTab = useAdminStore((state) => state.setTab);
  const error = useAdminStore((state) => state.error);
  const notice = useAdminStore((state) => state.notice);
  const clearNotice = useAdminStore((state) => state.clearNotice);

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-20">
        <Empty
          icon={Shield}
          title="Раздел только для администраторов"
          hint="Права выдаёт суперадминистратор площадки. Если они должны быть у вас — напишите ему."
          action={
            <Button className="mt-1" onClick={() => navigate('/')}>
              На главную
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <p className="label-caps">Управление площадкой</p>
      <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]">
        Админ-панель
      </h1>

      <div role="tablist" aria-label="Разделы админки" className="mt-7 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors duration-150 ${
                active
                  ? 'bg-brand text-white'
                  : 'border border-line-strong bg-surface text-ink-soft hover:border-brand/40 hover:text-ink'
              }`}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {(error || notice) && (
        <div className="mt-5" onClick={clearNotice} role="presentation">
          <Alert tone={error ? 'error' : 'success'}>{error ?? notice}</Alert>
        </div>
      )}

      <div className="mt-7">
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <UsersTab />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'offers' && <OffersTab />}
      </div>
    </div>
  );
}
