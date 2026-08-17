import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ICON, STROKE } from '../../lib/icons';

/**
 * Password strength, deliberately length-first.
 * NIST 800-63B: length beats composition rules, so the meter rewards it
 * rather than nagging for a symbol.
 */
export function scorePassword(value) {
  if (!value) return { score: 0, label: '' };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (variety >= 3 && value.length >= 10) score += 1;
  score = Math.min(4, score);
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

export default function PasswordField({
  value,
  onChange,
  label = 'Password',
  autoComplete = 'current-password',
  error = null,
  showStrength = false,
  hint = null,
  onEnter = null,
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const strength = showStrength ? scorePassword(value) : null;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
      </label>

      <div
        className={`flex items-stretch overflow-hidden rounded-control border bg-surface transition-colors duration-150 focus-within:border-brand/60 ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      >
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onEnter) onEnter();
          }}
          className="min-h-12 w-full min-w-0 bg-transparent px-3.5 text-[0.9375rem] text-ink outline-none placeholder:text-ink-muted/70"
        />
        <button
          type="button"
          onClick={() => setVisible((state) => !state)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="flex w-12 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          {visible ? (
            <EyeOff size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
          ) : (
            <Eye size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
          )}
        </button>
      </div>

      {showStrength && value && (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                  strength.score >= step
                    ? strength.score <= 1
                      ? 'bg-danger'
                      : strength.score === 2
                        ? 'bg-ink-muted'
                        : 'bg-signal'
                    : 'bg-line'
                }`}
              />
            ))}
          </div>
          <span className="w-12 shrink-0 text-xs font-medium text-ink-muted">{strength.label}</span>
        </div>
      )}

      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
