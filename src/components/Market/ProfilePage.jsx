import { useEffect } from 'react';
import { ExternalLink, MapPin, Quote } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { toHref } from '../../lib/router';
import ProjectCard from './ProjectCard';
import {
  Alert,
  Avatar,
  Card,
  Empty,
  Rating,
  RoleBadge,
  Spinner,
  Stars,
  StatusBadge,
  formatDate,
  money,
  plural,
  timeAgo,
} from './ui';

/**
 * Публичный профиль.
 *
 * Для программиста — навыки, стек, ставка и портфолио; для заказчика —
 * компания, опубликованные задачи и рейтинг. Разное содержание, одна вёрстка.
 */
export default function ProfilePage({ userId }) {
  const meta = useMarketStore((state) => state.meta);
  const payload = useMarketStore((state) => state.publicProfile);
  const loading = useMarketStore((state) => state.publicProfileLoading);
  const error = useMarketStore((state) => state.publicProfileError);
  const loadPublicProfile = useMarketStore((state) => state.loadPublicProfile);

  useEffect(() => {
    loadPublicProfile(userId);
  }, [userId, loadPublicProfile]);

  if (loading && !payload) return <Spinner label="Открываю профиль" />;
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-5 py-16">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  if (!payload) return null;

  const { user, profile, projects, reviews } = payload;
  const isDeveloper = user.role === 'developer';
  const sphere = (meta?.spheres ?? []).find((item) => item.id === user.sphere);
  const level = (meta?.levels ?? []).find((item) => item.id === user.level);
  const links = Object.entries(profile?.links ?? {}).filter(([, value]) => value);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ------------------------------------------------- визитка */}
        <aside className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <Avatar user={user} size={64} />
              <div className="min-w-0">
                <h1 className="truncate text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
                  {user.fullName || 'Участник площадки'}
                </h1>
                {isDeveloper && user.headline && (
                  <p className="mt-0.5 text-sm text-ink-muted">{user.headline}</p>
                )}
                {!isDeveloper && user.company && (
                  <p className="mt-0.5 text-sm text-ink-muted">{user.company}</p>
                )}
                <div className="mt-2">
                  <RoleBadge role={user.role} isAdmin={user.isAdmin} />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Rating value={user.rating} count={user.reviewsCount} />
            </div>

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5 text-sm">
              {isDeveloper ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Сфера</dt>
                    <dd className="font-medium text-ink">{sphere?.label ?? user.sphere}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Уровень</dt>
                    <dd className="font-medium text-ink">{level?.label ?? user.level}</dd>
                  </div>
                  {user.rateHour > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">Ставка</dt>
                      <dd className="tnum font-medium text-ink">{money(user.rateHour, user.currency)}/час</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Завершено работ</dt>
                    <dd className="tnum font-medium text-ink">{user.projectsDone}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Статус</dt>
                    <dd className="font-medium text-ink">{user.available ? 'Открыт к заказам' : 'Занят'}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Опубликовано задач</dt>
                    <dd className="tnum font-medium text-ink">{user.projectsPosted}</dd>
                  </div>
                  {user.site && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">Сайт</dt>
                      <dd className="min-w-0 truncate font-medium text-brand">
                        <a href={user.site} target="_blank" rel="noreferrer" className="hover:underline">
                          {user.site}
                        </a>
                      </dd>
                    </div>
                  )}
                </>
              )}
              {user.city && (
                <div className="flex justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-ink-muted">
                    <MapPin size={13} strokeWidth={1.7} aria-hidden="true" />
                    Город
                  </dt>
                  <dd className="font-medium text-ink">{user.city}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">На площадке с</dt>
                <dd className="font-medium text-ink">{formatDate(user.createdAt)}</dd>
              </div>
            </dl>

            {isDeveloper && user.stack && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="label-caps">Стек</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {user.stack
                    .split(/[,;]/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft"
                      >
                        {item}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="label-caps">Ссылки</p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {links.map(([key, value]) => (
                    <li key={key}>
                      <a
                        href={value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
                      >
                        {key}
                        <ExternalLink size={12} strokeWidth={1.7} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </aside>

        {/* ------------------------------------------------- содержание */}
        <div className="flex min-w-0 flex-col gap-8">
          {(profile?.bio || profile?.about) && (
            <Card className="p-6">
              <p className="label-caps">О себе</p>
              <p className="measure mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">
                {profile.bio || profile.about}
              </p>
            </Card>
          )}

          {isDeveloper && profile?.portfolio?.length > 0 && (
            <section aria-labelledby="portfolio-heading">
              <h2 id="portfolio-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
                Портфолио
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.portfolio.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <Card className="h-full p-4">
                      <p className="text-[0.9375rem] font-semibold text-ink">{item.title}</p>
                      {item.description && (
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.description}</p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2.5 inline-flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
                        >
                          Открыть работу
                          <ExternalLink size={12} strokeWidth={1.7} aria-hidden="true" />
                        </a>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
              {isDeveloper ? 'Работы на площадке' : 'Опубликованные задачи'}
            </h2>
            <div className="mt-4">
              {projects.length ? (
                isDeveloper ? (
                  <ul className="flex flex-col gap-2.5">
                    {projects.map((project) => (
                      <li key={project.id}>
                        <a
                          href={toHref(`/projects/${project.id}`)}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-brand/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{project.title}</span>
                            <span className="block text-xs text-ink-muted">{timeAgo(project.createdAt)}</span>
                          </span>
                          <StatusBadge status={project.status} />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {projects.map((project) => (
                      <ProjectCard key={project.id} project={project} categories={meta?.categories ?? []} />
                    ))}
                  </div>
                )
              ) : (
                <Empty
                  icon={Quote}
                  title="Пока пусто"
                  hint={
                    isDeveloper
                      ? 'Первая завершённая работа появится здесь автоматически.'
                      : 'Заказчик ещё не публиковал задач.'
                  }
                />
              )}
            </div>
          </section>

          <section aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
              Отзывы
              {reviews.length > 0 && (
                <span className="tnum ml-2 text-sm font-normal text-ink-muted">
                  {reviews.length} {plural(reviews.length, ['отзыв', 'отзыва', 'отзывов'])}
                </span>
              )}
            </h2>
            <div className="mt-4">
              {reviews.length ? (
                <ul className="flex flex-col gap-3">
                  {reviews.map((review) => (
                    <li key={review.id}>
                      <Card className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar user={review.author} size={36} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-ink">
                                {review.author?.fullName || 'Участник площадки'}
                              </span>
                              <Stars value={review.rating} size={13} />
                              <span className="ml-auto text-xs text-ink-muted">{timeAgo(review.createdAt)}</span>
                            </div>
                            {review.comment && (
                              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{review.comment}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={Quote} title="Отзывов ещё нет" hint="Они появляются после завершения проектов." />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
