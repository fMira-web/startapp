import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';

/**
 * Звёзды: и показ рейтинга, и живая оценка.
 *
 * В режиме показа это просто пять иконок с дробной заливкой.
 * В режиме оценки — настоящие кнопки: наведение подсвечивает, клик ставит
 * оценку, стрелки на клавиатуре двигают её на шаг.
 */
export default function RatingStars({
  value = 0,
  onChange = null,
  size = 18,
  showValue = false,
  label = null,
  className = '',
}) {
  const interactive = typeof onChange === 'function';
  const [hover, setHover] = useState(0);
  const reduce = useReducedMotion();
  const shown = hover || Number(value) || 0;

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((index) => {
            const fill = Math.max(0, Math.min(1, shown - index + 1));
            return (
              <span key={index} className="relative inline-flex" style={{ width: size, height: size }}>
                <Star size={size} strokeWidth={1.6} className="absolute inset-0 text-line-strong" />
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star size={size} strokeWidth={1.6} className="text-signal" fill="currentColor" />
                </span>
              </span>
            );
          })}
        </span>
        {showValue && (
          <span className="tnum text-sm font-medium text-ink">{Number(value).toFixed(1)}</span>
        )}
        <span className="sr-only">Рейтинг {Number(value).toFixed(1)} из 5</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="label-caps">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label ?? 'Оценка исполнителя'}
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((index) => {
          const active = index <= shown;
          return (
            <motion.button
              key={index}
              type="button"
              role="radio"
              aria-checked={Math.round(value) === index}
              aria-label={`${index} из 5`}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(index)}
              whileTap={reduce ? undefined : { scale: 0.85 }}
              animate={reduce ? undefined : { scale: active ? 1 : 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="cursor-pointer rounded-full p-1 text-ink-muted transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Star
                size={size + 6}
                strokeWidth={1.6}
                className={active ? 'text-signal' : 'text-line-strong'}
                fill={active ? 'currentColor' : 'none'}
              />
            </motion.button>
          );
        })}
        {shown > 0 && (
          <span className="ml-2 text-[0.8125rem] font-medium text-ink-soft">
            {['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'][Math.round(shown)]}
          </span>
        )}
      </div>
    </div>
  );
}
