import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Clock3,
  GraduationCap,
  MapPin,
  MessageSquareQuote,
  Play,
  Repeat2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMeta } from '../../store/useQuoteStore';
import { ROLE_BY_ID } from '../../data/hubData';
import { profileFor } from '../../data/developerProfiles';
import { formatCurrency, formatDate } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';
import RatingStars from './RatingStars';

function Initials({ name, size = 'lg' }) {
  const initials = String(name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand ${
        size === 'lg' ? 'h-16 w-16 text-xl' : 'h-9 w-9 text-sm'
      }`}
    >
      {initials}
    </span>
  );
}

function Stat({ icon: Icon, value, label }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="tnum mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">{value}</p>
    </div>
  );
}

function VideoCard({ item }) {
  const [playing, setPlaying] = useState(false);

  if (!item?.url) return null;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-ink/95">
      {playing ? (
        <video
          src={item.url}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full bg-black"
        >
          <track kind="captions" />
        </video>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative flex aspect-video w-full cursor-pointer items-center justify-center bg-gradient-to-br from-brand/25 via-ink to-ink"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-ink shadow-lg transition-transform duration-200 group-hover:scale-105">
            <Play size={22} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          </span>
          <span className="absolute bottom-3 left-4 right-4 text-left text-[0.8125rem] font-medium text-white/90">
            {item.title}
          </span>
        </button>
      )}
    </div>
  );
}

const TABS = [
  { id: 'about', label: 'О себе' },
  { id: 'experience', label: 'Опыт и CV' },
  { id: 'portfolio', label: 'Работы' },
  { id: 'reviews', label: 'Отзывы' },
];

export default function DeveloperProfile({ developer, onClose, onInvite = null, footer = null }) {
  const meta = useMeta();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState('about');

  const profile = useMemo(() => (developer ? profileFor(developer.id) : null), [developer]);
  const role = developer ? ROLE_BY_ID[developer.role] : null;

  useEffect(() => {
    if (!developer) return undefined;
    setTab('about');
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [developer, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {developer && profile && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Закрыть профиль"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[3px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Профиль: ${developer.full_name}`}
            initial={reduce ? false : { y: 28, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 16, opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative flex max-h-[92vh] w-full max-w-[46rem] flex-col overflow-hidden rounded-t-[1.25rem] border border-line bg-canvas shadow-[var(--shadow-lift)] sm:rounded-card"
          >
            <div className="flex items-start gap-4 border-b border-line bg-surface px-5 py-5 sm:px-7">
              <Initials name={developer.full_name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                    {developer.full_name}
                  </h2>
                  {developer.level && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-soft">
                      {developer.level}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {developer.headline ?? role?.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                  <RatingStars value={Number(developer.rating)} size={14} showValue />
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
                    {developer.city}
                  </span>
                  <span className="tnum inline-flex items-center gap-1.5">
                    <BriefcaseBusiness
                      size={ICON.xs}
                      strokeWidth={STROKE.regular}
                      aria-hidden="true"
                    />
                    {developer.projects_done} проектов
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-line bg-canvas text-ink-muted transition-colors hover:text-ink"
                >
                  <X size={ICON.sm} strokeWidth={STROKE.regular} />
                </button>
                <p className="tnum text-right text-base font-semibold text-ink">
                  {formatCurrency(developer.rate_hour, meta)}
                  <span className="block text-xs font-normal text-ink-muted">за час</span>
                </p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-line bg-surface px-3 sm:px-5">
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-selected={active}
                    role="tab"
                    className={`relative min-h-11 cursor-pointer px-3 text-[0.8125rem] font-medium transition-colors duration-150 ${
                      active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="profile-tab"
                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {tab === 'about' && (
                <div className="flex flex-col gap-5">
                  <VideoCard item={profile.videoIntro} />

                  <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{profile.about}</p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat
                      icon={Clock3}
                      label="Отвечает за"
                      value={profile.responseHours ? `${profile.responseHours} ч` : null}
                    />
                    <Stat
                      icon={ShieldCheck}
                      label="Сдано в срок"
                      value={profile.successRate ? `${profile.successRate}%` : null}
                    />
                    <Stat
                      icon={Repeat2}
                      label="Вернулись снова"
                      value={profile.repeatClients ? `${profile.repeatClients} клиентов` : null}
                    />
                  </div>

                  {profile.skills.length > 0 && (
                    <div>
                      <p className="label-caps">Навыки</p>
                      <ul className="mt-2.5 flex flex-wrap gap-2">
                        {profile.skills.map((skill) => (
                          <li
                            key={skill}
                            className="rounded-full border border-line bg-surface px-3 py-1 text-[0.8125rem] text-ink-soft"
                          >
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {profile.languages.length > 0 && (
                    <div>
                      <p className="label-caps">Языки</p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {profile.languages.map((item) => (
                          <li key={item} className="text-[0.8125rem] text-ink-muted">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === 'experience' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="label-caps">Опыт работы</p>
                    <ol className="mt-3 flex flex-col gap-4">
                      {profile.experience.map((entry) => (
                        <li key={`${entry.company}-${entry.period}`} className="flex gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          />
                          <div className="min-w-0">
                            <p className="text-[0.9375rem] font-medium text-ink">{entry.role}</p>
                            <p className="text-[0.8125rem] text-ink-soft">
                              {entry.company} · {entry.period}
                            </p>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                              {entry.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {profile.education.length > 0 && (
                    <div>
                      <p className="label-caps">Образование</p>
                      <ul className="mt-3 flex flex-col gap-3">
                        {profile.education.map((entry) => (
                          <li key={`${entry.place}-${entry.year}`} className="flex gap-3">
                            <GraduationCap
                              size={ICON.sm}
                              strokeWidth={STROKE.regular}
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 text-ink-muted"
                            />
                            <div>
                              <p className="text-[0.9375rem] font-medium text-ink">{entry.place}</p>
                              <p className="text-[0.8125rem] text-ink-muted">
                                {entry.degree} · {entry.year}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === 'portfolio' && (
                <div className="flex flex-col gap-5">
                  {profile.portfolio.length === 0 && (
                    <p className="text-sm text-ink-muted">Работы пока не добавлены.</p>
                  )}
                  {profile.portfolio.map((item) => (
                    <article key={item.title} className="flex flex-col gap-3">
                      {item.kind === 'video' ? (
                        <VideoCard item={item} />
                      ) : (
                        <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken px-4 py-6 text-center text-xs text-ink-muted">
                          Кейс без видео
                        </div>
                      )}
                      <div>
                        <p className="text-[0.9375rem] font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                          {item.description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {tab === 'reviews' && (
                <div className="flex flex-col gap-4">
                  {profile.reviews.length === 0 && (
                    <p className="text-sm text-ink-muted">Отзывов пока нет.</p>
                  )}
                  {profile.reviews.map((review) => (
                    <article
                      key={`${review.author}-${review.date}`}
                      className="rounded-card border border-line bg-surface p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Initials name={review.author} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[0.9375rem] font-medium text-ink">{review.author}</p>
                            <RatingStars value={review.rating} size={13} />
                          </div>
                          <p className="mt-1.5 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                            <MessageSquareQuote
                              size={ICON.xs}
                              strokeWidth={STROKE.regular}
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 text-ink-muted"
                            />
                            {review.text}
                          </p>
                          <p className="tnum mt-1.5 text-xs text-ink-muted">
                            {formatDate(review.date, meta.locale)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {(onInvite || footer) && (
              <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4 sm:px-7">
                {footer ?? <span className="text-xs text-ink-muted">Ставка и срок обсуждаются в отклике.</span>}
                {onInvite && (
                  <button
                    type="button"
                    onClick={() => onInvite(developer)}
                    className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
                  >
                    Пригласить в проект
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
