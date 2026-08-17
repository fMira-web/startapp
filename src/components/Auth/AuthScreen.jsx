import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, FileText, Loader2, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTemplate } from '../../store/useQuoteStore';
import { isValidEmail, toE164, detectDefaultCountry } from '../../data/countries';
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
  optional = false,
  inputRef = null,
  onEnter = null,
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-ink-soft">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">Optional</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
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
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
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
  const devCode = useAuthStore((state) => state.devCode);
  const resendAfter = useAuthStore((state) => state.resendAfter);

  const doRegister = useAuthStore((state) => state.register);
  const doLogin = useAuthStore((state) => state.login);
  const doVerify = useAuthStore((state) => state.verify);
  const doResend = useAuthStore((state) => state.resend);
  const showLogin = useAuthStore((state) => state.showLogin);
  const showRegister = useAuthStore((state) => state.showRegister);
  const backFromVerify = useAuthStore((state) => state.backFromVerify);
  const tickResend = useAuthStore((state) => state.tickResend);

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
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [screen]);

  const combinedErrors = { ...fieldErrors, ...localErrors };

  useEffect(() => {
    if (error) summaryRef.current?.focus();
  }, [error]);

  const submitRegister = async () => {
    const problems = {};
    if (!isValidEmail(email)) problems.email = 'Enter a valid email address.';
    if (password.length < 8) problems.password = 'Use at least 8 characters.';
    const phone = nationalNumber.trim() ? toE164(country.dialDigits, nationalNumber) : null;
    if (nationalNumber.trim() && !phone) {
      problems.phone = 'Enter a valid mobile number, or leave the field empty.';
    }
    setLocalErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const ok = await doRegister({
      email: email.trim(),
      password,
      fullName: fullName.trim() || undefined,
      phone,
    });
    if (ok) {
      setCode('');
      setResetToken((token) => token + 1);
    }
  };

  const submitLogin = async () => {
    const problems = {};
    if (!isValidEmail(email)) problems.email = 'Enter a valid email address.';
    if (!password) problems.password = 'Enter your password.';
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
            Demo build — no server, no database, no email is sent. Register with any address and
            the code appears on screen.
          </p>
        </div>
      )}

      <main className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-[26rem]">
          <AnimatePresence mode="wait" initial={false}>
            {/* ---------------------------------------------- sign in --- */}
            {screen === 'login' && (
              <motion.section key="login" {...motionProps} aria-labelledby="auth-heading">
                <p className="label-caps">Client access</p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  Sign in
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Your proposal is private. Sign in to read it and configure your scope.
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
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
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

                  <SubmitButton pending={pending} pendingLabel="Signing in">
                    Sign in
                  </SubmitButton>
                </form>

                <p className="mt-6 text-center text-sm text-ink-muted">
                  No account yet?{' '}
                  <button
                    type="button"
                    onClick={showRegister}
                    className="cursor-pointer font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Create one
                  </button>
                </p>
              </motion.section>
            )}

            {/* --------------------------------------------- register --- */}
            {screen === 'register' && (
              <motion.section key="register" {...motionProps} aria-labelledby="auth-heading">
                <p className="label-caps">Client access</p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  Create your account
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  We email a six-digit code to confirm the address before anything is shared.
                </p>

                <form
                  className="mt-7 flex flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitRegister();
                  }}
                >
                  <ErrorSummary message={error} refObject={summaryRef} />

                  <TextField
                    id="register-name"
                    label="Full name"
                    autoComplete="name"
                    placeholder="Daniel Reyes"
                    value={fullName}
                    onChange={setFullName}
                    optional
                    inputRef={firstFieldRef}
                  />

                  <TextField
                    id="register-email"
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
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
                    label="Password"
                    showStrength
                    hint="At least 8 characters. Longer beats complicated."
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

                  <SubmitButton pending={pending} pendingLabel="Creating account">
                    Create account
                  </SubmitButton>
                </form>

                <p className="mt-6 text-center text-sm text-ink-muted">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={showLogin}
                    className="cursor-pointer font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Sign in
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
                  Back
                </button>

                <p className="label-caps mt-3">Step 2 of 2</p>
                <h1
                  id="auth-heading"
                  className="mt-3 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink"
                >
                  Check your email
                </h1>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  We sent a six-digit code to{' '}
                  <span className="font-medium text-ink-soft">{pendingEmail}</span>. It expires in
                  ten minutes, and you can paste it.
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

                {devCode && (
                  <p className="tnum mt-4 rounded-control border border-line bg-surface-sunken px-3 py-2 text-center text-xs text-ink-muted">
                    {DEMO_MODE
                      ? 'Demo — no email is sent. Your code is '
                      : 'No mail provider configured on the server — your code is '}
                    {devCode}
                  </p>
                )}

                {error && (
                  <div className="mt-4">
                    <ErrorSummary message={error} refObject={summaryRef} />
                  </div>
                )}

                <div className="mt-5">
                  <SubmitButton
                    pending={pending}
                    pendingLabel="Verifying"
                    disabled={code.length < 6}
                    onClick={(event) => {
                      event.preventDefault();
                      submitCode(code);
                    }}
                  >
                    Verify and continue
                  </SubmitButton>
                </div>

                <div className="mt-4 text-center">
                  {resendAfter > 0 ? (
                    <p className="tnum text-sm text-ink-muted">
                      You can request a new code in {resendAfter}s
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={doResend}
                      disabled={pending}
                      className="min-h-11 cursor-pointer rounded-control px-2 text-sm font-medium text-brand underline-offset-4 hover:underline disabled:opacity-45"
                    >
                      Send a new code
                    </button>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <Lock size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
            Your password is stored only as a scrypt hash
          </p>
        </div>
      </main>
    </div>
  );
}
