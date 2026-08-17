import { useEffect, useRef, useState } from 'react';
import { useSpring, useReducedMotion } from 'framer-motion';
import { formatCurrency } from '../../lib/format';

/**
 * Rolling-number transition for the running total.
 *
 * A spring drives the displayed value toward the real total, so a selection
 * change reads as the number travelling rather than snapping. Digits are
 * tabular so the string never reflows while it counts.
 *
 * Under prefers-reduced-motion the value is set directly.
 */
export default function AnimatedPriceTotal({
  value,
  locale = 'en-US',
  currency = 'USD',
  className = '',
}) {
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
    <span
      className={`tnum ${className}`}
      aria-label={formatCurrency(value, { locale, currency })}
    >
      <span aria-hidden="true">{formatCurrency(display, { locale, currency })}</span>
    </span>
  );
}
