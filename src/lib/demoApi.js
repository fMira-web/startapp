/**
 * Demo transport.
 *
 * Enabled with VITE_DEMO_MODE=1. Every call is answered in the browser, so the
 * full journey — register, verification code, sign in, configure, accept — can
 * be explored from a single static deployment with no server, no database, and
 * no email provider.
 *
 * It mirrors the real API's shapes and error codes exactly, so `api.js` can
 * swap one for the other without any component knowing. Nothing here is a
 * security boundary: accounts live in a module-level Map and disappear on
 * reload. The real implementation is the one in `backend/`.
 */

const users = new Map(); // email -> { email, password, fullName, phone, verified }
const codes = new Map(); // email -> { code, expiresAt, attempts }
let session = null;

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

class DemoError extends Error {
  constructor(message, { status = 400, code = 'bad_input', field = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.payload = payload;
  }
}

/** Latency the eye can register, so pending states are actually visible. */
const settle = (value, ms = 550) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const WEAK = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', 'iloveyou']);

function normalise(email) {
  const value = String(email ?? '').trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : null;
}

function issueCode(email) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  codes.set(email, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
  return code;
}

function publicUser(user) {
  return {
    id: `demo-${user.email}`,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    emailVerified: user.verified,
  };
}

export async function register({ email, password, fullName, phone }) {
  const normalised = normalise(email);
  if (!normalised) {
    throw new DemoError('Enter a valid email address.', { code: 'bad_email', field: 'email' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new DemoError('Use at least 8 characters.', { code: 'bad_password', field: 'password' });
  }
  if (WEAK.has(password.toLowerCase())) {
    throw new DemoError('That password is too common. Choose another.', {
      code: 'bad_password',
      field: 'password',
    });
  }

  const existing = users.get(normalised);
  if (existing?.verified) {
    throw new DemoError('That email already has an account. Sign in instead.', {
      status: 409,
      code: 'email_taken',
      field: 'email',
    });
  }

  users.set(normalised, {
    email: normalised,
    password,
    fullName: fullName ?? null,
    phone: phone ?? null,
    verified: false,
  });

  return settle({
    status: 'verification_sent',
    email: normalised,
    devCode: issueCode(normalised),
    resendAfterSeconds: 20,
  });
}

export async function verifyEmail({ email, code }) {
  const normalised = normalise(email);
  const record = normalised ? codes.get(normalised) : null;

  if (!record || record.expiresAt <= Date.now()) {
    throw new DemoError('That code has expired. Request a new one.', {
      status: 410,
      code: 'expired',
    });
  }

  record.attempts += 1;
  if (record.attempts > MAX_ATTEMPTS) {
    codes.delete(normalised);
    throw new DemoError('Too many incorrect attempts. Request a new code.', {
      status: 429,
      code: 'too_many_attempts',
    });
  }

  if (record.code !== code) {
    const left = MAX_ATTEMPTS - record.attempts;
    throw new DemoError(
      left > 0
        ? `That code is not right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
        : 'That code is not right.',
      { status: 401, code: 'invalid_code' }
    );
  }

  codes.delete(normalised);
  const user = users.get(normalised);
  user.verified = true;
  session = publicUser(user);
  return settle({ user: session });
}

export async function resendCode(email) {
  const normalised = normalise(email);
  const user = normalised ? users.get(normalised) : null;
  if (!user || user.verified) {
    return settle({ status: 'verification_sent', resendAfterSeconds: 20 });
  }
  return settle({
    status: 'verification_sent',
    devCode: issueCode(normalised),
    resendAfterSeconds: 20,
  });
}

export async function login({ email, password }) {
  const normalised = normalise(email);
  const user = normalised ? users.get(normalised) : null;

  if (!user || user.password !== password) {
    throw new DemoError('Email or password is incorrect.', {
      status: 401,
      code: 'bad_credentials',
    });
  }

  if (!user.verified) {
    throw new DemoError('Confirm your email address first — we sent you a code.', {
      status: 403,
      code: 'email_unverified',
      payload: {
        email: user.email,
        devCode: issueCode(user.email),
        resendAfterSeconds: 20,
      },
    });
  }

  session = publicUser(user);
  return settle({ user: session });
}

export async function logout() {
  session = null;
  return settle({ ok: true }, 150);
}

export async function fetchCurrentUser() {
  return settle(session, 200);
}

let acceptance = null;

export async function acceptProposal() {
  if (!session) {
    throw new DemoError('Sign in to continue.', { status: 401, code: 'unauthenticated' });
  }
  acceptance = { acceptedAt: new Date().toISOString() };
  return settle({ recorded: true, acceptedAt: acceptance.acceptedAt }, 700);
}

export async function fetchAcceptance() {
  return settle(acceptance, 150);
}

export async function getCapabilities() {
  return settle(
    { email: true, emailMode: 'demo', storage: 'demo', reachable: true },
    120
  );
}
