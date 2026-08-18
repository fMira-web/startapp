import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, Search } from 'lucide-react';
import { countries, detectDefaultCountry, searchCountries } from '../../data/countries';
import { ICON, STROKE } from '../../lib/icons';

/**
 * International phone entry: a searchable country/dial-code selector plus the
 * national number. The parent receives an E.164 string (or null while invalid).
 */
export default function PhoneField({
  country,
  onCountryChange,
  value,
  onValueChange,
  invalid,
  errorMessage = null,
  optional = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);

  const reduce = useReducedMotion();
  const listboxId = useId();
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const results = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(Math.max(0, countries.findIndex((entry) => entry.iso === country.iso)));
      const timer = setTimeout(() => searchRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, country.iso]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commit = (entry) => {
    if (!entry) return;
    onCountryChange(entry);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex items-baseline gap-2 text-sm font-medium text-ink-soft">
        Номер телефона
        {optional && <span className="text-xs font-normal text-ink-muted">необязательно</span>}
      </label>

      <div ref={wrapperRef} className="relative">
        <div
          className={`flex items-stretch overflow-hidden rounded-control border bg-surface transition-colors duration-150 focus-within:border-brand/60 ${
            invalid ? 'border-danger' : 'border-line-strong'
          }`}
        >
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((state) => !state)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Телефонный код страны, сейчас ${country.name} ${country.dial}`}
            className="flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 border-r border-line px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-sunken"
          >
            <span className="text-xs font-semibold tracking-[0.04em] text-ink-muted">
              {country.iso}
            </span>
            <span className="tnum">{country.dial}</span>
            <ChevronDown
              size={ICON.xs}
              strokeWidth={STROKE.regular}
              aria-hidden="true"
              className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>

          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={value}
            aria-invalid={invalid || undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            onChange={(event) => onValueChange(event.target.value)}
            className="tnum min-h-12 w-full min-w-0 bg-transparent px-3.5 text-[0.9375rem] text-ink outline-none placeholder:text-ink-muted/70"
          />
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 origin-top overflow-hidden rounded-control border border-line bg-surface shadow-[var(--shadow-float)]"
            >
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                <Search size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" className="text-ink-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Страна или код"
                  aria-label="Поиск страны или телефонного кода"
                  aria-controls={listboxId}
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/70"
                />
              </div>

              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Страны"
                className="max-h-64 overflow-y-auto py-1"
              >
                {results.length === 0 && (
                  <li className="px-3.5 py-3 text-sm text-ink-muted">Ничего не найдено</li>
                )}
                {results.map((entry, index) => {
                  const selected = entry.iso === country.iso;
                  return (
                    <li key={entry.iso}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => commit(entry)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors duration-100 ${
                          index === activeIndex ? 'bg-brand-tint' : 'bg-transparent'
                        }`}
                      >
                        <span className="w-7 shrink-0 text-xs font-semibold tracking-[0.04em] text-ink-muted">
                          {entry.iso}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink">{entry.name}</span>
                        <span className="tnum shrink-0 text-ink-muted">{entry.dial}</span>
                        {selected && (
                          <Check
                            size={ICON.xs}
                            strokeWidth={STROKE.emphasis}
                            aria-hidden="true"
                            className="shrink-0 text-brand"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {errorMessage && (
        <p id={errorId} className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle
            size={ICON.xs}
            strokeWidth={STROKE.regular}
            aria-hidden="true"
            className="mt-[0.2rem] shrink-0"
          />
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export { detectDefaultCountry };
