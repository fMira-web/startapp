import { Check } from 'lucide-react';
import Reveal from './Reveal';
import { useTemplate } from '../store/useQuoteStore';
import { formatCurrency, formatDate } from '../lib/format';
import { ICON, STROKE } from '../lib/icons';

function MetaItem({ label, value }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:py-0">
      <dt className="label-caps">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export default function BriefSection() {
  const template = useTemplate();
  const { client, meta, basePackage } = template;

  return (
    <section aria-labelledby="brief-heading" className="pt-14 sm:pt-20 lg:pt-24">
      <Reveal>
        <p className="label-caps">Proposal · {formatDate(meta.issuedOn, meta.locale)}</p>
        <h1
          id="brief-heading"
          className="mt-5 text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[2.75rem] lg:text-[3.25rem]"
        >
          Proposal for {client.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
          {client.summary}
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <dl className="mt-10 grid grid-cols-1 divide-y divide-line rounded-card border border-line bg-surface px-5 py-1 sm:grid-cols-4 sm:divide-x sm:divide-y-0 sm:px-0 sm:py-5">
          <div className="sm:px-6">
            <MetaItem label="Prepared for" value={client.company} />
          </div>
          <div className="sm:px-6">
            <MetaItem label="Project ID" value={meta.proposalId} />
          </div>
          <div className="sm:px-6">
            <MetaItem label="Valid until" value={formatDate(meta.validUntil, meta.locale)} />
          </div>
          <div className="sm:px-6">
            <MetaItem label="Lead contact" value={meta.leadContact.name} />
          </div>
        </dl>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-16 sm:mt-20">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Executive summary
          </h2>
          <div className="measure mt-6 space-y-5">
            {client.brief.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0
                    ? 'text-[1.0625rem] leading-[1.75] text-ink-soft first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[3.25rem] first-letter:font-semibold first-letter:leading-[0.82] first-letter:text-brand'
                    : 'text-[1.0625rem] leading-[1.75] text-ink-soft'
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
          {client.objectives.map((objective) => (
            <div key={objective} className="flex items-start gap-3 border-t border-line pt-4">
              <Check
                size={ICON.sm}
                strokeWidth={STROKE.regular}
                aria-hidden="true"
                className="mt-1 shrink-0 text-brand"
              />
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{objective}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <article className="mt-16 overflow-hidden rounded-card border border-line bg-surface sm:mt-20">
          <div className="flex flex-col gap-4 border-b border-line px-6 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:px-8">
            <div>
              <p className="label-caps">Phase 01 · Fixed scope</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.015em] text-ink sm:text-2xl">
                {basePackage.name}
              </h3>
            </div>
            <div className="sm:text-right">
              <p className="tnum text-2xl font-semibold tracking-[-0.02em] text-ink">
                {formatCurrency(basePackage.price, meta)}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">{basePackage.timeline}</p>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <p className="measure text-[0.9375rem] leading-relaxed text-ink-soft">
              {basePackage.description}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
              {basePackage.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check
                    size={ICON.sm}
                    strokeWidth={STROKE.regular}
                    aria-hidden="true"
                    className="mt-[0.3rem] shrink-0 text-signal"
                  />
                  <span className="text-sm leading-relaxed text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </Reveal>
    </section>
  );
}
