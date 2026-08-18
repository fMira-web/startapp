import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, BriefcaseBusiness, PlayCircle } from 'lucide-react';
import { useMeta } from '../../store/useQuoteStore';
import { ROLES, ROLE_BY_ID } from '../../data/hubData';
import { profileFor } from '../../data/developerProfiles';
import { formatCurrency } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';
import RatingStars from './RatingStars';

function Avatar({ name }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand"
    >
      {initials}
    </span>
  );
}

export function DeveloperCard({ developer, action = null, highlight = false, onOpen = null }) {
  const meta = useMeta();
  const role = ROLE_BY_ID[developer.role];
  const profile = profileFor(developer.id);
  const clickable = typeof onOpen === 'function';

  return (
    <motion.div
      whileHover={clickable ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={`flex h-full flex-col rounded-card border bg-surface p-5 transition-colors duration-200 ${
        highlight ? 'border-brand/45' : 'border-line hover:border-line-strong'
      } ${clickable ? 'hover:shadow-[var(--shadow-lift)]' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen?.(developer)}
        disabled={!clickable}
        aria-label={clickable ? `Открыть профиль: ${developer.full_name}` : undefined}
        className="flex items-start gap-3 rounded-control text-left enabled:cursor-pointer"
      >
        <span className="relative">
          <Avatar name={developer.full_name} />
          {profile.videoIntro && (
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-brand ring-1 ring-line"
            >
              <PlayCircle size={14} strokeWidth={2} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
            {developer.full_name}
          </p>
          <p className="truncate text-xs text-ink-muted">{developer.headline}</p>
        </div>
        <span className="tnum flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
          <RatingStars value={Number(developer.rating)} size={13} />
          {Number(developer.rating).toFixed(1)}
        </span>
      </button>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">{developer.stack}</p>

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <div className="flex items-center gap-1.5">
          <MapPin size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
          <dd>{developer.city}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <BriefcaseBusiness size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
          <dd className="tnum">{developer.projects_done} проектов</dd>
        </div>
        {developer.level && (
          <dd className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium text-ink-soft">
            {developer.level}
          </dd>
        )}
      </dl>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="tnum text-base font-semibold tracking-[-0.01em] text-ink">
            {formatCurrency(developer.rate_hour, meta)}
          </p>
          <p className="text-xs text-ink-muted">за час · {role?.short ?? developer.role}</p>
        </div>
        {action ?? (
          clickable && (
            <button
              type="button"
              onClick={() => onOpen(developer)}
              className="min-h-9 cursor-pointer rounded-control border border-line px-3 text-[0.8125rem] font-medium text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink"
            >
              Профиль и работы
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

export default function DeveloperBoard({ developers, footerFor = null, onOpen = null }) {
  const [role, setRole] = useState('all');

  const visible = useMemo(
    () => (role === 'all' ? developers : developers.filter((dev) => dev.role === role)),
    [developers, role]
  );

  const counts = useMemo(() => {
    const map = { all: developers.length };
    for (const dev of developers) map[dev.role] = (map[dev.role] ?? 0) + 1;
    return map;
  }, [developers]);

  return (
    <section aria-labelledby="developers-heading" className="mt-12">
      <div className="flex flex-col gap-3 border-t border-line pt-8">
        <p className="label-caps">Исполнители</p>
        <h2
          id="developers-heading"
          className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]"
        >
          Кто может взять этот проект
        </h2>
        <p className="measure text-[0.9375rem] leading-relaxed text-ink-muted">
          Нажмите на карточку — откроются CV, видео-визитка, работы и отзывы. Ставки указаны в
          сумах за час и соответствуют уровню рынка Узбекистана. Исполнитель получает деньги
          после того, как вы примете работу.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[{ id: 'all', short: 'Все' }, ...ROLES].map((item) => {
          const active = role === item.id;
          const count = counts[item.id] ?? 0;
          if (item.id !== 'all' && count === 0) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              aria-pressed={active}
              className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong'
              }`}
            >
              {item.short}
              <span className={`tnum text-xs ${active ? 'text-white/70' : 'text-ink-muted'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <motion.div layout className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((developer) => (
          <DeveloperCard
            key={developer.id}
            developer={developer}
            onOpen={onOpen}
            action={footerFor ? footerFor(developer) : null}
          />
        ))}
      </motion.div>

      {visible.length === 0 && (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-6 text-sm text-ink-muted">
          В этой роли пока никого нет.
        </p>
      )}
    </section>
  );
}
