import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Briefcase, Check, Code2, FileText, Loader2, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTemplate } from '../../store/useQuoteStore';
import { isValidEmail, toE164, detectDefaultCountry } from '../../data/countries';
import { LEVELS, SPHERES, STACK_PLACEHOLDER } from '../../lib/marketDicts';
import { DEMO_MODE } from '../../lib/api';
import { ICON, STROKE } from '../../lib/icons';
import PasswordField from './PasswordField';
import PhoneField from '../Checkout/PhoneField';
import OtpInput from '../Checkout/OtpInput';

function ErrorSummary({ message, refObject }) {
  if (!message) return null;
  return (
    <div
      ref={refObject}
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-2.5 rounded-control border border-danger/30 bg-danger-tint px-4 py-3"
    >
      <AlertCircle
        size={ICON.xs}
        strokeWidth={STROKE.regular}
        aria-hidden="true"
        className="mt-[0.2rem] shrink-0 text-danger"
      />
      <p className="text-[0.8125rem] leading-relaxed text-danger">{message}</p>
    </div>
  );
}

function TextField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  hint = null,
  inputMode = undefined,
  optional = false,
  inputRef = null,
  onEnter = null,
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-ink-soft">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">необязательно</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) onEnter();
        }}
        className={`min-h-12 w-full rounded-control border bg-surface px-3.5 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-ink-muted/70 focus:border-brand/60 ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Кто вы на площадке.
 *
 * Это первый вопрос регистрации, потому что от ответа зависит весь
 * дальнейший интерфейс: заказчик публикует задачу, исполнитель ищет её.
 */
const ROLE_OPTIONS = [
  {
    id: 'client',
    icon: Briefcase,
    title: 'Я заказчик',
    lead: 'Мне нужно, чтобы сделали',
    points: ['Опишу задачу своими словами', 'Получу отклики с ценами', 'Плачу только после приёмки'],
  },
  {
    id: 'developer',
    icon: Code2,
    title: 'Я программист',
    lead: 'Разработчик, дизайнер, QA, DevOps',
    points: ['Вижу открытые задачи', 'Называю свою цену и срок', 'Деньги в резерве до сдачи'],
  },
];

function RoleChoice({ value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-sm font-medium text-ink-soft">Кто вы на площадке</legend>
      <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const active = value === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-card border p-4 text-left transition-all duration-200 ${
                active
                  ? 'border-brand bg-brand-tint ring-1 ring-brand/30'
                  : 'border-line-strong bg-surface hover:border-brand/40'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors duration-200 ${
                  active ? 'bg-brand text-white' : 'bg-surface-sunken text-ink-muted'
                }`}
              >
                <Icon size={ICON.sm} strokeWidth={STROKE.regular} />
              </span>
              <span>
                <span className={`block text-[0.9375rem] font-semibold ${active ? 'text-brand' : 'text-ink'}`}>
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">{option.lead}</span>
              </span>
              <ul className="mt-1 flex flex-col gap-1">
                {option.points.map((point) => (
                  <li key={point} className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
                    <Check
                      size={12}
                      strokeWidth={2.2}
                      aria-hidden="true"
                      className={`mt-[0.2rem] shrink-0 ${active ? 'text-brand' : 'text-line-strong'}`}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Дополнительный шаг регистрации программиста.
 *
 * Появляется только для роли «Программист» и собирает то, без чего профиль
 * бесполезен на доске: сферу, уровень и основной стек. Заказчику этот экран
 * не показывается вовсе — у него другой набор полей.
 */
function CraftStep({ value, onChange, errors }) {
  const set = (key) => (next) => onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium text-ink-soft">Сфера разработки</legend>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SPHERES.map((sphere) => {
            const active = value.sphere === sphere.id;
            return (
              <button
                key={sphere.id}
                type="button"
                aria-pressed={active}
                onClick={() => set('sphere')(sphere.id)}
                className={`cursor-pointer rounded-control border px-3 py-2.5 text-left transition-all duration-150 ${
                  active
                    ? 'border-brand bg-brand-tint ring-1 ring-brand/30'
                    : 'border-line-strong bg-surface hover:border-brand/40'
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? 'text-brand' : 'text-ink'}`}>
                  {sphere.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{sphere.hint}</span>
              </button>
            );
          })}
        </div>
        {errors.sphere && <p className="text-xs text-danger">{errors.sphere}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium text-ink-soft">Уровень</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVELS.map((level) => {
            const active = value.level === level.id;
            return (
              <button
                key={level.id}
                type="button"
                aria-pressed={active}
                onClick={() => set('level')(level.id)}
                className={`cursor-pointer rounded-control border px-3 py-2.5 text-left transition-all duration-150 ${
                  active
                    ? 'border-brand bg-brand-tint ring-1 ring-brand/30'
                    : 'border-line-strong bg-surface hover:border-brand/40'
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? 'text-brand' : 'text-ink'}`}>
                  {level.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{level.hint}</span>
              </button>
            );
          })}
        </div>
        {errors.level && <p className="text-xs text-danger">{errors.level}</p>}
      </fieldset>

      <TextField
        id="register-stack"
        label="Основной стек технологий"
        placeholder={STACK_PLACEHOLDER[value.sphere] ?? 'React, Node.js, PostgreSQL'}
        value={value.stack}
        onChange={set('stack')}
        error={errors.stack}
        hint="Через запятую. По этим словам вас находят заказчики."
      />

      <TextField
        id="register-headline"
        label="Короткое описание"
        placeholder="Fullstack · React + Node.js"
        value={value.headline}
        onChange={set('headline')}
        optional
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="register-city"
          label="Город"
          placeholder="Ташкент"
          value={value.city}
          onChange={set('city')}
          optional
        />
        <TextField
          id="register-rate"
          label="Ставка за час, сум"
          placeholder="120000"
          inputMode="numeric"
          value={value.rateHour}
          onChange={set('rateHour')}
          optional
        />
      </div>
    </div>
  );
}

function SubmitButton({ pending, children, pendingLabel, onClick, disabled }) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 text-[0.9375rem] font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? (
        <>
          <Loader2
            size={ICON.sm}
            strokeWidth={STROKE.regular}
            className="animate-spin"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export default function AuthScreen() {
  const template = useTemplate();
  const reduce = useReducedMotion();

  const screen = useAuthStore((state) => state.screen);
  const pending = useAuthStore((state) => state.pending);
  const error = useAuthStore((state) => state.error);
  const fieldErrors = useAuthStore((state) => state.fieldErrors);
  const pendingEmail = useAuthStore((state) => state.pendingEmail);
  const resendAfter = useAuthStore((state) => state.resendAfter);

  const doRegister = useAuthStore((state) => state.register);
  const doLogin = useAuthStore((state) => state.login);
  const doVerify = useAuthStore((state) => state.verify);
  const doResend = useAuthStore((state) => state.resend);
  const showLogin = useAuthStore((state) => state.showLogin);
  const showRegister = useAuthStore((state) => state.showRegister);
  const backFromVerify = useAuthStore((state) => state.backFromVerify);
  const tickResend = useAuthStore((state) => state.tickResend);

  const setPendingRole = useAuthStore((state) => state.setPendingRole);
  const pendingRole = useAuthStore((state) => state.pendingRole);

  const [role, setRole] = useState('client');
  /* Регистрация программиста двухшаговая: сначала аккаунт, потом ремесло. */
  const [stage, setStage] = useState('account');
  const [craft, setCraft] = useState({
    sphere: 'fullstack',
    level: 'middle',
    stack: '',
    headline: '',
    city: '',
    rateHour: '',
  });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState(() => detectDefaultCountry());
  const [nationalNumber, setNationalNumber] = useState('');
  const [localErrors, setLocalErrors] = useState({});
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState(0);

  const summaryRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (resendAfter <= 0) return undefined;
    const timer = setTimeout(tickResend, 1000);
    return () => clearTimeout(timer);
  }, [resendAfter, tickResend]);

  useEffect(() => {
    setLocalErrors({});
    setStage('account');
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [screen]);

  const combinedErrors = { ...fieldErrors, ...localErrors };

  useEffect(() => {
    if (error) summaryRef.current?.focus();
  }, [error]);

  const submitRegister = async () => {
    const problems = {};

    // Первый шаг проверяем всегда — на втором эти поля уже валидны.
    if (!isValidEmail(email)) problems.email = 'Введите корректный адрес почты.';
    if (password.length < 8) problems.password = 'Пароль — минимум 8 символов.';
    const phone = nationalNumber.trim() ? toE164(country.dialDigits, nationalNumber) : null;
    if (nationalNumber.trim() && !phone) {
      problems.phone = 'Введите корректный номер телефона или оставьте поле пустым.';
    }

    if (Object.keys(problems).length > 0) {
      setLocalErrors(problems);
      setStage('account');
      return;
    }

    // Программиста ведём на дополнительный шаг: сфера, уровень, стек.
    if (role === 'developer' && stage === 'account') {
      setLocalErrors({});
      setStage('craft');
      return;
    }

    if (role === 'developer') {
      if (!craft.sphere) problems.sphere = 'Выберите сферу разработки.';
      if (!craft.level) problems.level = 'Выберите уровень.';
      if (craft.stack.trim().length < 2) problems.stack = 'Укажите основной стек — хотя бы пару технологий.';
      setLocalErrors(problems);
      if (Object.keys(problems).length > 0) return;
    }

    const ok = await doRegister({
      email: email.trim(),
      password,
      fullName: fullName.trim() || undefined,
      phone,
      role,
      devProfile:
        role === 'developer'
          ? {
              sphere: craft.sphere,
              level: craft.level,
              stack: craft.stack.trim(),
              headline: craft.headline.trim() || null,
              city: craft.city.trim() || null,
              rateHour: Number(craft.rateHour) || 0,
            }
          : undefined,
    });
    if (ok) {
      setCode('');
      setResetToken((token) => token + 1);
    }
  };

  const submitLogin = async () => {
    const problems = {};
    if (!isValidEmail(email)) problems.email = 'Введите корректный адрес почты.';
    if (!password) problems.password = 'Введите пароль.';
    setLocalErrors(problems);
    if (Object.keys(problems).length > 0) return;
    await doLogin({ email: email.trim(), password });
  };

  const submitCode = async (fullCode) => {
    const ok = await doVerify(fullCode);
    if (!ok) {
      setCode('');
      setResetToken((token) => token + 1);
    }
  };

  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-5 sm:px-8">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand text-white"
          >
            <FileText size={ICON.sm} strokeWidth={STROKE.regular} />
          </span>
          <p className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
            {template.meta.studio.name}
          </p>
        </div>
      </header>

      {DEMO_MODE && (
        <div className="border-b border-line bg-brand-tint">
          <p className="mx-auto w-full max-w-[1240px] px-5 py-2.5 text-center text-[0.8125rem] leading-relaxed text-brand sm:px-8">
            Демо-режим — без сервера, базы и писем. Регистрируйтесь на любой адрес,
            а на шаге подтверждения введите любые шесть цифр.
          </p>
        </div>
      )}

      <main className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-[26rem]">
          <AnimatePresence mode="wait" initial={false}>
            {/* ---------------------------------------------- sign in --- */}
            {screen === 'login' && (
              <motion.section key="login" {...motionProps} aria-labelledby="auth-heading">
                <p className="label-caps">Центр проектов</p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  Вход
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Заказчики публикуют задачи, исполнители называют цену. Войдите, чтобы продолжить.
                </p>

                <form
                  className="mt-7 flex flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitLogin();
                  }}
                >
                  <ErrorSummary message={error} refObject={summaryRef} />

                  <TextField
                    id="login-email"
                    label="Электронная почта"
                    type="email"
                    autoComplete="email"
                    placeholder="siz@kompaniya.uz"
                    value={email}
                    onChange={(next) => {
                      setEmail(next);
                      setLocalErrors((state) => ({ ...state, email: null }));
                    }}
                    error={combinedErrors.email}
                    inputRef={firstFieldRef}
                  />

                  <PasswordField
                    value={password}
                    onChange={(next) => {
                      setPassword(next);
                      setLocalErrors((state) => ({ ...state, password: null }));
                    }}
                    autoComplete="current-password"
                    error={combinedErrors.password}
                  />

                  <SubmitButton pending={pending} pendingLabel="Вхожу">
                    Войти
                  </SubmitButton>
                </form>

                <p className="mt-6 text-center text-sm text-ink-muted">
                  Ещё нет аккаунта?{' '}
                  <button
                    type="button"
                    onClick={showRegister}
                    className="cursor-pointer font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Создайте его
                  </button>
                </p>
              </motion.section>
            )}

            {/* --------------------------------------------- register --- */}
            {screen === 'register' && (
              <motion.section key="register" {...motionProps} aria-labelledby="auth-heading">
                {stage === 'craft' && (
                  <button
                    type="button"
                    onClick={() => setStage('account')}
                    className="-ml-1 mb-3 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-1 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
                  >
                    <ArrowLeft size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
                    Назад к аккаунту
                  </button>
                )}

                <p className="label-caps">
                  {role === 'developer'
                    ? `Шаг ${stage === 'craft' ? 2 : 1} из 3`
                    : 'Шаг 1 из 2'}
                </p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  {stage === 'craft' ? 'Чем вы занимаетесь' : 'Создайте аккаунт'}
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  {stage === 'craft'
                    ? 'Эти поля формируют вашу карточку в каталоге и попадают в отклики. Позже их можно поменять в профиле — в отличие от роли.'
                    : role === 'developer'
                      ? 'Профиль программиста: задачи, отклики и выплаты после приёмки. Роль выбирается один раз и потом не меняется.'
                      : 'Аккаунт заказчика: задача, отклики с ценами и оплата после приёмки. Роль выбирается один раз и потом не меняется.'}
                </p>

                <form
                  className="mt-7 flex flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitRegister();
                  }}
                >
                  <ErrorSummary message={error} refObject={summaryRef} />

                  {stage === 'account' ? (
                    <>
                      <RoleChoice
                        value={role}
                        onChange={(next) => {
                          setRole(next);
                          setPendingRole(next);
                          setStage('account');
                        }}
                      />

                      <TextField
                        id="register-name"
                        label="Имя и фамилия"
                        autoComplete="name"
                        placeholder="Нодира Юсупова"
                        value={fullName}
                        onChange={setFullName}
                        optional
                        inputRef={firstFieldRef}
                      />

                      <TextField
                        id="register-email"
                        label="Электронная почта"
                        type="email"
                        autoComplete="email"
                        placeholder="siz@kompaniya.uz"
                        value={email}
                        onChange={(next) => {
                          setEmail(next);
                          setLocalErrors((state) => ({ ...state, email: null }));
                        }}
                        error={combinedErrors.email}
                      />

                      <PasswordField
                        value={password}
                        onChange={(next) => {
                          setPassword(next);
                          setLocalErrors((state) => ({ ...state, password: null }));
                        }}
                        autoComplete="new-password"
                        label="Пароль"
                        showStrength
                        hint="Минимум 8 символов. Длинный лучше, чем сложный."
                        error={combinedErrors.password}
                      />

                      <PhoneField
                        country={country}
                        onCountryChange={setCountry}
                        value={nationalNumber}
                        onValueChange={(next) => {
                          setNationalNumber(next);
                          setLocalErrors((state) => ({ ...state, phone: null }));
                        }}
                        invalid={Boolean(combinedErrors.phone)}
                        errorMessage={combinedErrors.phone}
                        optional
                      />
                    </>
                  ) : (
                    <CraftStep
                      value={craft}
                      onChange={(next) => {
                        setCraft(next);
                        setLocalErrors((state) => ({ ...state, sphere: null, level: null, stack: null }));
                      }}
                      errors={combinedErrors}
                    />
                  )}

                  <SubmitButton pending={pending} pendingLabel="Создаю аккаунт">
                    {role === 'developer'
                      ? stage === 'account'
                        ? 'Дальше: специализация'
                        : 'Создать профиль программиста'
                      : 'Создать аккаунт заказчика'}
                  </SubmitButton>
                </form>

                <p className="mt-6 text-center text-sm text-ink-muted">
                  Уже зарегистрированы?{' '}
                  <button
                    type="button"
                    onClick={showLogin}
                    className="cursor-pointer font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Войти
                  </button>
                </p>
              </motion.section>
            )}

            {/* ----------------------------------------------- verify --- */}
            {screen === 'verify' && (
              <motion.section key="verify" {...motionProps} aria-labelledby="auth-heading">
                <button
                  type="button"
                  onClick={backFromVerify}
                  className="-ml-1 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-1 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
                >
                  <ArrowLeft size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
                  Назад
                </button>

                <p className="label-caps mt-3">
                  {pendingRole === 'developer' ? 'Шаг 3 из 3' : 'Шаг 2 из 2'}
                </p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  Проверьте почту
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Мы отправили шестизначный код на{' '}
                  <span className="font-medium text-ink-soft">{pendingEmail}</span>. Он действует
                  десять минут, код можно вставить из буфера.
                </p>

                <div className="mt-7">
                  <OtpInput
                    resetToken={resetToken}
                    disabled={pending}
                    invalid={Boolean(error)}
                    onChange={setCode}
                    onComplete={submitCode}
                  />
                </div>

                {/* Код — секрет получателя и на экране не показывается
                    никогда: иначе зарегистрироваться на чужой адрес сможет
                    кто угодно. Единственный канал доставки — письмо. */}
                <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
                  Письмо приходит в течение минуты. Если его нет — загляните в «Спам»
                  и «Промоакции», а потом запросите код заново.
                </p>

                {error && (
                  <div className="mt-4">
                    <ErrorSummary message={error} refObject={summaryRef} />
                  </div>
                )}

                <div className="mt-5">
                  <SubmitButton
                    pending={pending}
                    pendingLabel="Проверяю"
                    disabled={code.length < 6}
                    onClick={(event) => {
                      event.preventDefault();
                      submitCode(code);
                    }}
                  >
                    Подтвердить и продолжить
                  </SubmitButton>
                </div>

                <div className="mt-4 text-center">
                  {resendAfter > 0 ? (
                    <p className="tnum text-sm text-ink-muted">
                      Новый код можно запросить через {resendAfter} с
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={doResend}
                      disabled={pending}
                      className="min-h-11 cursor-pointer rounded-control px-2 text-sm font-medium text-brand underline-offset-4 hover:underline disabled:opacity-45"
                    >
                      Отправить новый код
                    </button>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <Lock size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            Пароль хранится только в виде scrypt-хеша
          </p>
        </div>
      </main>
    </div>
  );
}
