import { useEffect, useRef, useState } from 'react';

const LENGTH = 6;
const EMPTY = Array.from({ length: LENGTH }, () => '');

/**
 * Six-digit code entry.
 *  - auto-focuses the first field
 *  - advances on input, steps back on backspace
 *  - accepts a pasted code in any field
 *  - reports the joined value; the parent auto-submits at six digits
 */
export default function OtpInput({ onChange, onComplete, disabled = false, invalid = false, resetToken = 0 }) {
  const [digits, setDigits] = useState(EMPTY);
  const refs = useRef([]);
  const completedRef = useRef(false);

  useEffect(() => {
    setDigits(EMPTY);
    completedRef.current = false;
    const first = refs.current[0];
    if (first) first.focus();
  }, [resetToken]);

  useEffect(() => {
    const joined = digits.join('');
    onChange?.(joined);
    if (joined.length === LENGTH && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(joined);
    }
    if (joined.length < LENGTH) {
      completedRef.current = false;
    }
    // onChange/onComplete are stable callbacks from the parent's render scope;
    // reacting to `digits` alone is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const focusField = (index) => {
    const target = refs.current[Math.min(LENGTH - 1, Math.max(0, index))];
    if (target) {
      target.focus();
      target.select?.();
    }
  };

  const writeFrom = (startIndex, characters) => {
    if (!characters.length) return;
    const next = [...digits];
    let cursor = startIndex;
    for (const character of characters) {
      if (cursor >= LENGTH) break;
      next[cursor] = character;
      cursor += 1;
    }
    setDigits(next);
    focusField(cursor >= LENGTH ? LENGTH - 1 : cursor);
  };

  const handleChange = (index, rawValue) => {
    const characters = rawValue.replace(/\D/g, '').split('');
    if (characters.length === 0) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    writeFrom(index, characters);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        setDigits(next);
        focusField(index);
      } else if (index > 0) {
        next[index - 1] = '';
        setDigits(next);
        focusField(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusField(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusField(index + 1);
    }
  };

  const handlePaste = (index, event) => {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    writeFrom(index, pasted.slice(0, LENGTH - index).split(''));
  };

  return (
    <div
      role="group"
      aria-label="Six digit verification code"
      className="flex items-center justify-between gap-2 sm:gap-2.5"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={LENGTH}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={`tnum h-14 w-full min-w-0 rounded-control border bg-surface text-center text-xl font-semibold text-ink transition-[border-color,box-shadow] duration-150 disabled:opacity-50 sm:h-16 sm:text-2xl ${
            invalid
              ? 'border-danger'
              : digit
                ? 'border-brand/50 shadow-[0_0_0_3px_rgba(30,58,95,0.06)]'
                : 'border-line-strong'
          }`}
        />
      ))}
    </div>
  );
}
