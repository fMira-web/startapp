import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowDown, BadgeCheck, Clock3, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { ICON, STROKE } from '../../lib/icons';

/**
 * Первый экран Центра проектов.
 *
 * Задача у него одна: за две секунды объяснить, что здесь происходит, и
 * увести человека вниз — к форме задачи. Поэтому цифры считаются на глазах,
 * а не лежат статичным текстом, и вся типографика идёт по одной вертикали.
 */

/** Счётчик, который добегает до значения, когда блок появился на экране. */
function Counter({ to, decimals = 0, duration = 1100 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setValue(to);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic: быстро в начале, мягко в конце — читается как «живое».
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className="tnum">
      {value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

const STEPS = [
  {
    id: 1,
    title: 'Опишите задачу',
    text: 'Своими словами. Смета собирается прямо во время набора.',
  },
  {
    id: 2,
    title: 'Соберите отклики',
    text: 'Исполнители называют свою цену и срок — вы сравниваете.',
  },
  {
    id: 3,
    title: 'Платите после приёмки',
    text: 'Деньги держит площадка. Уходят исполнителю по вашей кнопке.',
  },
];

export default function HubHero({ developers = [], averageRating = 4.8, onStart = null }) {
  const reduce = useReducedMotion();

  const stats = useMemo(() => {
    const cities = new Set(developers.map((dev) => dev.city).filter(Boolean));
    const done = developers.reduce((sum, dev) => sum + (Number(dev.projects_done) || 0), 0);
    return { people: developers.length, cities: cities.size || 4, done };
  }, [developers]);

  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
        };

  return (
    <section aria-labelledby="hub-hero-heading" className="relative overflow-hidden">
      {/* Мягкое световое пятно за заголовком — глубина без единой картинки. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-brand) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-10 h-[20rem] w-[20rem] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-signal) 0%, transparent 70%)' }}
      />

      <div className="relative">
        <motion.p {...rise(0)} className="label-caps">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            Центр проектов · Узбекистан
          </span>
        </motion.p>

        <motion.h1
          {...rise(0.05)}
          id="hub-hero-heading"
          className="mt-4 max-w-[18ch] text-[2.5rem] font-semibold leading-[1.03] tracking-[-0.035em] text-ink sm:text-[3.5rem] lg:text-[4rem]"
        >
          Опишите задачу —{' '}
          <span className="relative whitespace-nowrap text-brand">
            цену назовут
            <motion.span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-[3px] w-full origin-left rounded-full bg-brand/35"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>{' '}
          исполнители
        </motion.h1>

        <motion.p
          {...rise(0.12)}
          className="measure mt-5 text-[1.125rem] leading-relaxed text-ink-soft"
        >
          Ни одного прайса «от и до». Вы пишете, что нужно, — и получаете живые
          предложения от разработчиков, дизайнеров и тестировщиков. Деньги лежат
          в резерве площадки, пока вы не примете работу.
        </motion.p>

        <motion.div {...rise(0.18)} className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="group flex min-h-12 cursor-pointer items-center gap-2 rounded-control bg-brand px-6 text-[0.9375rem] font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
          >
            Поставить задачу
            <ArrowDown
              size={ICON.sm}
              strokeWidth={STROKE.regular}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-y-0.5"
            />
          </button>

          <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[0.8125rem] text-ink-muted">
            <ShieldCheck
              size={ICON.xs}
              strokeWidth={STROKE.regular}
              aria-hidden="true"
              className="text-brand"
            />
            Оплата только после приёмки
          </span>
        </motion.div>

        {/* Цифры площадки. Считаются при появлении — экран сразу «дышит». */}
        <motion.dl
          {...rise(0.24)}
          className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4"
        >
          {[
            {
              label: 'исполнителей в базе',
              node: <Counter to={stats.people} />,
              icon: BadgeCheck,
            },
            { label: 'городов', node: <Counter to={stats.cities} />, icon: null },
            {
              label: 'проектов сдано',
              node: (
                <>
                  <Counter to={stats.done} />+
                </>
              ),
              icon: null,
            },
            {
              label: 'средняя оценка',
              node: <Counter to={averageRating} decimals={1} />,
              icon: Star,
            },
          ].map((item) => (
            <div key={item.label} className="bg-surface px-5 py-5">
              <dd className="flex items-baseline gap-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink">
                {item.node}
                {item.icon && (
                  <item.icon
                    size={14}
                    strokeWidth={STROKE.regular}
                    aria-hidden="true"
                    className="translate-y-[-2px] text-signal"
                    fill={item.icon === Star ? 'currentColor' : 'none'}
                  />
                )}
              </dd>
              <dt className="mt-1.5 text-xs text-ink-muted">{item.label}</dt>
            </div>
          ))}
        </motion.dl>

        {/* Три шага. Ровно столько, сколько человек удерживает без усилия. */}
        <motion.ol {...rise(0.3)} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.34 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-card border border-line bg-surface px-5 py-5"
            >
              <span
                aria-hidden="true"
                className="tnum flex h-7 w-7 items-center justify-center rounded-full bg-brand-tint text-[0.8125rem] font-semibold text-brand"
              >
                {step.id}
              </span>
              <p className="mt-3 text-[0.9375rem] font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{step.text}</p>
            </motion.li>
          ))}
        </motion.ol>

        <motion.p
          {...rise(0.4)}
          className="mt-5 flex items-center gap-2 text-xs text-ink-muted"
        >
          <Clock3 size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
          Первые отклики обычно приходят в течение дня.
        </motion.p>
      </div>
    </section>
  );
}
