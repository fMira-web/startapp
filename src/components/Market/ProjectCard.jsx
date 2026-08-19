import { Clock3, Eye, MessagesSquare, Wallet } from 'lucide-react';
import { toHref } from '../../lib/router';
import {
  Avatar,
  ModerationBadge,
  Rating,
  StatusBadge,
  TagPill,
  moneyShort,
  plural,
  timeAgo,
} from './ui';

/**
 * Карточка проекта на доске.
 *
 * Сверху — статус и бюджет, потому что именно по ним исполнитель решает,
 * читать ли дальше. Автор и счётчики внизу: они важны, но не первыми.
 */
export default function ProjectCard({ project, categories = [] }) {
  const category = categories.find((item) => item.id === project.category);
  const budget =
    project.budgetMin && project.budgetMin !== project.budgetMax
      ? `${moneyShort(project.budgetMin, project.currency)} — ${moneyShort(project.budgetMax, project.currency)}`
      : moneyShort(project.budgetMax || project.budgetMin, project.currency);

  return (
    <article className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        <ModerationBadge moderation={project.moderation} />
        {category && (
          <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
            {category.label}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-muted">{timeAgo(project.createdAt)}</span>
      </div>

      <h3 className="mt-3 text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink">
        <a href={toHref(`/projects/${project.id}`)} className="outline-none after:absolute group-hover:text-brand">
          {project.title}
        </a>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">
        {project.description}
      </p>

      {project.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 5).map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <span className="tnum inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Wallet size={15} strokeWidth={1.7} className="text-ink-muted" aria-hidden="true" />
          {budget}
        </span>
        {project.deadlineDays ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock3 size={14} strokeWidth={1.7} aria-hidden="true" />
            до {project.deadlineDays} {plural(project.deadlineDays, ['дня', 'дней', 'дней'])}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <MessagesSquare size={14} strokeWidth={1.7} aria-hidden="true" />
          {project.bidsCount} {plural(project.bidsCount, ['отклик', 'отклика', 'откликов'])}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <Eye size={14} strokeWidth={1.7} aria-hidden="true" />
          {project.views}
        </span>
      </div>

      {project.owner && (
        <div className="mt-3 flex items-center gap-2.5">
          <Avatar user={project.owner} size={28} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-ink-soft">
              {project.owner.fullName || 'Заказчик площадки'}
            </p>
            <Rating value={project.owner.rating} count={project.owner.reviewsCount} size={12} />
          </div>
        </div>
      )}
    </article>
  );
}
