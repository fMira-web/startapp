import { useEffect, useState } from 'react';
import { Briefcase, Lock, Plus, UserRound } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate, toHref } from '../../lib/router';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  RoleBadge,
  Select,
  Spinner,
  StatusBadge,
  TextArea,
  money,
  plural,
  timeAgo,
} from './ui';

/**
 * Личный кабинет.
 *
 * Поля профиля зависят от роли, и это единственное место, где она вообще
 * упоминается как настройка, — рядом с замком и пояснением, что менять её
 * нельзя. Так честнее, чем прятать факт и оставлять человека гадать.
 */

function DeveloperFields({ draft, set, meta }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="me-sphere"
          label="Сфера"
          value={draft.sphere ?? ''}
          onChange={set('sphere')}
          options={meta?.spheres ?? []}
        />
        <Select
          id="me-level"
          label="Уровень"
          value={draft.level ?? ''}
          onChange={set('level')}
          options={meta?.levels ?? []}
        />
      </div>
      <Input
        id="me-headline"
        label="Короткое описание"
        placeholder="Fullstack · React + Node.js"
        value={draft.headline ?? ''}
        onChange={set('headline')}
      />
      <Input
        id="me-stack"
        label="Стек технологий"
        placeholder="React, Node.js, PostgreSQL, Payme API"
        value={draft.stack ?? ''}
        onChange={set('stack')}
        hint="Через запятую — по этим словам вас находят в каталоге."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="me-rate"
          label="Ставка за час, сум"
          inputMode="numeric"
          value={draft.rateHour ?? ''}
          onChange={set('rateHour')}
          className="tnum"
        />
        <Input id="me-city" label="Город" value={draft.city ?? ''} onChange={set('city')} />
      </div>
      <TextArea
        id="me-bio"
        label="О себе"
        rows={5}
        placeholder="Чем занимаетесь, какие проекты вели, как работаете с заказчиком."
        value={draft.bio ?? ''}
        onChange={set('bio')}
      />
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={draft.available !== false}
          onChange={(event) => set('available')(event.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[color:var(--color-brand)]"
        />
        <span className="text-sm text-ink-soft">Открыт к новым заказам</span>
      </label>
    </>
  );
}

function ClientFields({ draft, set }) {
  return (
    <>
      <Input
        id="me-company"
        label="Компания"
        placeholder="Toshkent Retail"
        value={draft.company ?? ''}
        onChange={set('company')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="me-city" label="Город" value={draft.city ?? ''} onChange={set('city')} />
        <Input
          id="me-site"
          label="Сайт"
          placeholder="https://company.uz"
          value={draft.site ?? ''}
          onChange={set('site')}
        />
      </div>
      <TextArea
        id="me-about"
        label="О компании"
        rows={5}
        placeholder="Чем занимаетесь и какие задачи обычно отдаёте на аутсорс."
        value={draft.about ?? ''}
        onChange={set('about')}
      />
    </>
  );
}

export default function CabinetPage() {
  const user = useAuthStore((state) => state.user);
  const meta = useMarketStore((state) => state.meta);
  const cabinet = useMarketStore((state) => state.cabinet);
  const loading = useMarketStore((state) => state.cabinetLoading);
  const error = useMarketStore((state) => state.cabinetError);
  const loadCabinet = useMarketStore((state) => state.loadCabinet);
  const saveProfile = useMarketStore((state) => state.saveProfile);

  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    loadCabinet();
  }, [loadCabinet]);

  useEffect(() => {
    if (cabinet) setDraft({ fullName: cabinet.user.fullName ?? '', ...cabinet.profile });
  }, [cabinet]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-20">
        <Empty
          icon={UserRound}
          title="Здесь ваш профиль"
          hint="Войдите в аккаунт, чтобы увидеть свои задачи, отклики и настройки."
          action={
            <Button className="mt-1" onClick={() => navigate('/login')}>
              Войти
            </Button>
          }
        />
      </div>
    );
  }

  if (loading && !cabinet) return <Spinner label="Открываю кабинет" />;
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-5 py-16">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  if (!cabinet) return null;

  const isDeveloper = cabinet.user.role === 'developer';
  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setSaveError(null);
    try {
      await saveProfile({
        ...draft,
        rateHour: draft.rateHour === '' ? 0 : Number(draft.rateHour ?? 0),
      });
      setSaved(true);
    } catch (profileError) {
      setSaveError(profileError?.message ?? 'Не удалось сохранить профиль.');
    }
    setPending(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar user={cabinet.user} size={56} />
        <div className="min-w-0">
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink">
            {cabinet.user.fullName || cabinet.user.email || 'Личный кабинет'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RoleBadge role={cabinet.user.role} isAdmin={cabinet.user.isAdmin} />
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Lock size={12} strokeWidth={1.8} aria-hidden="true" />
              Роль зафиксирована при регистрации
            </span>
          </div>
        </div>
        {cabinet.user.role === 'client' && (
          <Button className="ml-auto" onClick={() => navigate('/projects/new')}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Разместить задачу
          </Button>
        )}
      </div>

      <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* ------------------------------------------------- мои дела */}
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="my-projects-heading">
            <h2 id="my-projects-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
              {isDeveloper ? 'Проекты в работе' : 'Мои задачи'}
              <span className="tnum ml-2 text-sm font-normal text-ink-muted">{cabinet.projects.length}</span>
            </h2>
            <div className="mt-4">
              {cabinet.projects.length ? (
                <ul className="flex flex-col gap-2.5">
                  {cabinet.projects.map((project) => (
                    <li key={project.id}>
                      <a
                        href={toHref(`/projects/${project.id}`)}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5 transition-colors duration-150 hover:border-brand/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{project.title}</span>
                          <span className="tnum block text-xs text-ink-muted">
                            {money(project.budgetMax, project.currency)} · {project.bidsCount}{' '}
                            {plural(project.bidsCount, ['отклик', 'отклика', 'откликов'])} ·{' '}
                            {timeAgo(project.createdAt)}
                          </span>
                        </span>
                        <StatusBadge status={project.status} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty
                  icon={Briefcase}
                  title={isDeveloper ? 'Пока нет проектов в работе' : 'Вы ещё не публиковали задач'}
                  hint={
                    isDeveloper
                      ? 'Откликнитесь на открытую задачу — она появится здесь, как только заказчик выберет вас.'
                      : 'Первая задача займёт пару минут: название, описание и вилка бюджета.'
                  }
                  action={
                    <Button
                      size="sm"
                      className="mt-1"
                      onClick={() => navigate(isDeveloper ? '/projects' : '/projects/new')}
                    >
                      {isDeveloper ? 'Смотреть задачи' : 'Разместить задачу'}
                    </Button>
                  }
                />
              )}
            </div>
          </section>

          {isDeveloper && (
            <section aria-labelledby="my-bids-heading">
              <h2 id="my-bids-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
                Мои отклики
                <span className="tnum ml-2 text-sm font-normal text-ink-muted">{cabinet.bids.length}</span>
              </h2>
              <div className="mt-4">
                {cabinet.bids.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {cabinet.bids.map((bid) => (
                      <li key={bid.id}>
                        <a
                          href={toHref(`/projects/${bid.projectId}`)}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5 transition-colors duration-150 hover:border-brand/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {bid.project?.title ?? 'Проект удалён'}
                            </span>
                            <span className="tnum block text-xs text-ink-muted">
                              {money(bid.amount)} · {bid.days} {plural(bid.days, ['день', 'дня', 'дней'])} ·{' '}
                              {timeAgo(bid.createdAt)}
                            </span>
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              bid.status === 'accepted'
                                ? 'bg-signal-tint text-signal'
                                : bid.status === 'declined'
                                  ? 'bg-surface-sunken text-ink-muted'
                                  : 'bg-brand-tint text-brand'
                            }`}
                          >
                            {bid.status === 'accepted'
                              ? 'Принят'
                              : bid.status === 'declined'
                                ? 'Отклонён'
                                : 'На рассмотрении'}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty
                    icon={Briefcase}
                    title="Откликов пока нет"
                    hint="Найдите задачу по своей сфере и предложите цену — это занимает минуту."
                  />
                )}
              </div>
            </section>
          )}
        </div>

        {/* ------------------------------------------------- профиль */}
        <aside>
          <Card className="p-6">
            <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">Профиль</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Это видят все на площадке: заказчики — при выборе исполнителя, исполнители — при
              оценке задачи.
            </p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
              <Alert tone="error">{saveError}</Alert>
              {saved && <Alert tone="success">Профиль сохранён.</Alert>}

              <Input
                id="me-name"
                label="Имя и фамилия"
                value={draft.fullName ?? ''}
                onChange={set('fullName')}
              />

              {isDeveloper ? (
                <DeveloperFields draft={draft} set={set} meta={meta} />
              ) : (
                <ClientFields draft={draft} set={set} />
              )}

              <Button type="submit" pending={pending} className="w-fit">
                Сохранить профиль
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 border-t border-line pt-5">
              <Lock size={15} strokeWidth={1.7} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-ink-muted">
                Роль «{isDeveloper ? 'Программист' : 'Заказчик'}» изменить нельзя: она выбирается
                один раз при регистрации. Если роль выбрана по ошибке, напишите администратору
                площадки — только он может её переназначить.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
