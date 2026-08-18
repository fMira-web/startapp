import { useEffect, useRef, useState } from 'react';
import { useSpring, useReducedMotion } from 'framer-motion';
import { formatCurrency } from '../../lib/format';

/**
 * Плавный пересчёт итоговой суммы.
 *
 * Пружина ведёт показываемое значение к настоящему итогу, поэтому смена
 * конфигурации читается как «число доехало», а не «скакнуло». Цифры
 * табличные, строка не дёргается по ширине.
 *
 * При prefers-reduced-motion значение ставится напрямую.
 */
export default function AnimatedPriceTotal({ value, meta, className = '' }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const mounted = useRef(false);

  const spring = useSpring(value, {
    stiffness: 140,
    damping: 26,
    mass: 0.7,
    restDelta: 1,
  });

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!mounted.current) {
      mounted.current = true;
      if (typeof spring.jump === 'function') spring.jump(value);
      else spring.set(value);
      setDisplay(value);
      return;
    }
    spring.set(value);
  }, [value, reduce, spring]);

  useEffect(() => {
    if (reduce) return undefined;
    const unsubscribe = spring.on('change', (latest) => {
      setDisplay(latest);
    });
    return unsubscribe;
  }, [spring, reduce]);

  return (
    <span className={`tnum ${className}`} aria-label={formatCurrency(value, meta)}>
      <span aria-hidden="true">{formatCurrency(display, meta)}</span>
    </span>
  );
}
