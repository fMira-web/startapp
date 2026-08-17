# Interactive Proposal & Quoting Experience

A private, account-gated web experience where a client signs in, reads their
tailored project brief, configures the scope by toggling capabilities and
moving quantity controls, watches the total recalculate live, and accepts —
with acceptance recorded against their verified account.

Frontend: React + Vite + Tailwind CSS + Framer Motion + Zustand + Lucide.
Backend: Node/Express + Postgres.

---

## How access works

1. **Register** — email, password, optional name and mobile number.
2. **A six-digit code is emailed to that address** — the one the person typed,
   not the mailbox the server sends through.
3. **Verify** — the code activates the account and issues a session.
4. **Sign in** afterwards with email + password. An unverified account is not
   an error: signing in re-sends the code and drops straight to the code screen.
5. The session is a JWT in an **httpOnly cookie** — never readable from
   JavaScript, never written to `localStorage`.
6. **Accepting the proposal** is an authenticated action recorded against the
   user in Postgres. There is no second one-time code at that step; the session
   is the signature.

### "Why is my Gmail in the config?"

`SMTP_USER` / `SMTP_PASS` are the mailbox the server sends **through** — the
postman. `MAIL_FROM` is the return address on the envelope. The **recipient**
is always the address the person entered:

```js
await transport.sendMail({
  from: MAIL_FROM,  // your address
  to,               // ← the address they registered with
  subject: `${code} is your verification code`,
});
```

One sending mailbox serves every user. (Gmail caps around 500 messages a day
and mail arrives from a personal address; for launch, put a domain behind
Resend or SES — same code, different variables.)

---

## Sending email — no vendor lock

At boot the server picks the first transport that is fully configured and logs
which one it chose:

| Order | Transport | Configured by |
|---|---|---|
| 1 | **Resend** | `RESEND_API_KEY` |
| 2 | **SMTP** — any mailbox | `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` |
| 3 | **dev** — console + on-screen | nothing |

Gmail with an [App Password](https://myaccount.google.com/apppasswords):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=the-16-character-app-password
SMTP_SECURE=true
MAIL_FROM=Your Name <you@gmail.com>
```

Yandex (`smtp.yandex.ru:465`), Mail.ru (`smtp.mail.ru:465`), Outlook
(`smtp-mail.outlook.com:587`, `SMTP_SECURE=false`) and corporate relays work
the same way. In production with no transport configured, the server refuses to
issue a code rather than leaking one to the browser.

---

## Getting started

```bash
# frontend
npm install
cp .env.example .env          # point VITE_API_BASE_URL at the backend
npm run dev                   # http://localhost:5173

# backend, in a second terminal
cd backend
npm install
cp .env.example .env          # runs as-is; fill in a transport when ready
npm run dev                   # http://localhost:4000
```

Nothing needs configuring to try the whole flow. With no `DATABASE_URL`,
accounts live in memory; with no mail provider, the code is printed to the
backend console **and** shown on the verification screen. Both fallbacks are
development-only — the server refuses to start on memory storage in production.

---

## Security posture

- **Passwords**: scrypt (N=16384, r=8, p=1, 64-byte key, unique 16-byte salt),
  via `node:crypto` — no native module to compile on Render. Stored as
  `scrypt$N$r$p$salt$hash`; compared with `timingSafeEqual`.
- **Password policy**: NIST 800-63B — a length floor of 8, a ceiling of 200, a
  blocklist of the usual suspects. No composition rules, no forced rotation,
  paste always allowed.
- **Codes**: never stored in the clear. Only an HMAC-SHA256 digest keyed by
  `JWT_SECRET` and the code's row id. Ten-minute expiry, five attempts,
  60-second resend cooldown, older codes invalidated when a new one is issued.
- **Enumeration**: login answers "Email or password is incorrect" either way and
  hashes a decoy when the account does not exist, so timing does not leak
  membership. `resend-code` always returns success. Registration is the one
  deliberate exception — telling someone their address already has an account is
  worth more than the disclosure costs.
- **Session**: JWT, 7 days, httpOnly + `SameSite=None; Secure` in production
  (Vercel and Render are different sites), `SameSite=Lax` locally.
- **CORS**: strict allowlist with `credentials: true`. An empty list in
  production rejects every cross-origin browser request.
- **Rate limits**: 20 auth attempts and 40 code attempts per IP per 15 minutes.
- **SQL**: every statement parameterised; ids generated in Node, so no
  `pgcrypto` / `uuid-ossp` extension is required.

---

## Design direction

The visual system was derived with the
[`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
design-intelligence skill (`--domain color`, `--domain typography`,
`--domain ux`, `--stack react`) and then constrained to the brief.

| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#F9FAFB` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, sheets, modal |
| `--color-ink` | `#0F172A` | Primary text — charcoal slate, never pure black |
| `--color-ink-soft` | `#334155` | Body copy |
| `--color-ink-muted` | `#55637A` | Secondary text (5.8:1 on canvas) |
| `--color-line` | `#E8EAEE` | Hairline borders |
| `--color-brand` | `#1E3A5F` | Midnight blue — selected state, primary CTA |
| `--color-signal` | `#15803D` | Forest green — verified, savings, confirmation |
| `--color-danger` | `#B91C1C` | Validation errors |

Inter throughout, with `font-variant-numeric: tabular-nums` (`.tnum`) on every
number so figures never reflow while the total animates. No gradients, no
coloured shadows, no emoji. Icon sizes and stroke weights come from tokens in
`src/lib/icons.js` — the skill's pro-rules single out arbitrary icon sizing and
mixed stroke weights as the two habits that most cheapen an interface.

**Accessibility rules from the skill, all applied:**

- Text contrast ≥ 4.5:1; visible focus rings, never removed.
- 44×44px minimum on every control.
- `prefers-reduced-motion` honoured everywhere — scroll reveals, layout
  animations, and the counting total render their final state instantly.
- *Accessible Authentication* (WCAG 2.2 AA, Critical): paste is never blocked,
  the code field carries `autocomplete="one-time-code"`, pasting into any of the
  six boxes fills the rest, and the password field has a show/hide toggle.
- *Error placement* and *focusable error summary*: a failed submit renders a
  `role="alert"` summary that takes focus, alongside an inline message tied to
  the field with `aria-describedby` — never one without the other.
- `aria-busy` on every async action; the live total is announced through one
  polite region rather than on every animation frame.
- *Focus not obscured*: `scroll-margin-top` clears the sticky header.

---

## Data model

`src/data/proposalTemplate.js` is the single source of truth for the proposal.
Replace the export with an API response and nothing else changes.

```
meta          proposalId, version, dates, currency, locale, lead contact
client        name, company, project title, summary, brief, objectives
basePackage   fixed-scope foundation: price, timeline, inclusions
sections[]    kind: 'toggles' | 'quantities' | 'tier'
discounts[]   percent or fixed, with conditions (e.g. 4+ optional items)
tax           label + rate
payment       instalment schedule as shares of the total
```

`computeQuote(template, selections)` in `src/store/useQuoteStore.js` is a **pure
function** — line items, subtotal, conditional discounts, tax, total, and the
payment schedule are recomputed synchronously on every interaction. Selections
persist to `localStorage` and are re-merged against the current template on
load, so an updated proposal never inherits a stale selection key.

### Database

```sql
users                 id, email (unique), password_hash, full_name, phone,
                      email_verified, created_at, last_login_at
email_codes           id, user_id, code_hash, purpose, attempts,
                      expires_at, consumed_at, created_at
proposal_acceptances  id, user_id, proposal_id, total_cents, currency,
                      line_items, accepted_at
```

Created automatically on boot (`create table if not exists`).

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create the account, email a code |
| `POST` | `/api/auth/verify-email` | Confirm the code, issue the session |
| `POST` | `/api/auth/resend-code` | New code, subject to the cooldown |
| `POST` | `/api/auth/login` | Email + password; `403 email_unverified` re-sends |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Current user, or `401` |
| `POST` | `/api/proposal/accept` | Record acceptance (session required) |
| `GET` | `/api/proposal/acceptance` | Prior acceptance for a returning client |
| `GET` | `/api/capabilities` | What the environment can do |
| `GET` | `/health` | Uptime, storage mode, email transport |

---

## Deployment

Step-by-step, with the exact variables and the mistakes that cost an hour:
**[DEPLOY.md](./DEPLOY.md)**.

The short version: Render first (Blueprint at `render.yaml` in the repo root
creates Postgres + the API), then Vercel with `VITE_API_BASE_URL` pointing at
the Render URL, then set `ALLOWED_ORIGINS` on Render to the exact Vercel origin.

For a clickable preview with no backend at all, build the frontend with
`VITE_DEMO_MODE=1` — see the demo section in DEPLOY.md.

---

## Architecture

```
src/
├── components/
│   ├── Auth/
│   │   ├── AuthScreen.jsx            sign in / register / verify, one surface
│   │   └── PasswordField.jsx         show-hide toggle, length-first strength
│   ├── Header.jsx                    sticky chrome, scroll progress, sign out
│   ├── BriefSection.jsx              greeting, executive summary, base package
│   ├── Reveal.jsx                    scroll reveal, reduced-motion aware
│   ├── SignedConfirmation.jsx        post-acceptance record
│   ├── InteractiveModules/
│   │   ├── ModuleSection.jsx         renders a section by kind
│   │   ├── FeatureToggleCard.jsx     full-surface toggle, spring checkmark
│   │   ├── QuantitySelector.jsx      stepper + range, live line total
│   │   └── TierSelector.jsx          radio group, shared layout highlight
│   └── Checkout/
│       ├── StickySummary.jsx         desktop receipt (exports SummaryBody)
│       ├── MobileSummaryBar.jsx      floating bar + expandable sheet
│       ├── AnimatedPriceTotal.jsx    spring-driven rolling total
│       ├── OtpInput.jsx              6-digit entry, paste, auto-submit
│       └── PhoneField.jsx            country search + national number
├── store/
│   ├── useQuoteStore.js              selections + pure pricing engine
│   └── useAuthStore.js               session, auth screens, code flow
├── data/proposalTemplate.js          the proposal
├── data/countries.js                 245 dial codes, E.164, validation
├── lib/api.js                        fetch wrapper, credentials, typed errors
├── lib/useAcceptance.js              accept + restore prior acceptance
├── lib/format.js                     currency, dates, masking
├── lib/icons.js                      icon size and stroke tokens
├── lib/demoApi.js                    in-browser API for VITE_DEMO_MODE=1
└── styles/global.css                 design tokens + base layer

backend/
├── server.js                         app wiring, CORS, limits, proposal routes
├── auth.js                           scrypt, JWT, codes, auth routes
├── db.js                             Postgres adapter + in-memory dev fallback
└── mailer.js                         Resend / SMTP / dev transport

render.yaml                           Render Blueprint (must stay at the root)
vercel.json                           SPA rewrite, caching, security headers
DEPLOY.md                             deployment walkthrough
```

---

## Verified before hand-off

`npm install` could not be run in the authoring environment (package registries
were unreachable), so the following were executed instead:

- Every `.js` / `.jsx` file parses cleanly (`tsc --noEmit --allowJs --jsx preserve`).
- **The auth flow was booted against stubbed transports and every route
  exercised**: invalid email / short password / blocklisted password / bad phone,
  email normalisation, code delivery, wrong code, code replay after success,
  login before verification (`403 email_unverified`), wrong password and unknown
  account returning identical messages, session issue → `/api/auth/me` → logout →
  `401`, acceptance rejected without a cookie and recorded with one, prior
  acceptance readable on return, duplicate registration (`409`), and
  `resend-code` staying silent about unknown addresses.
- **Password hashing**: format, unique salt per hash, correct/incorrect/empty
  password, malformed stored hash failing closed, and a real scrypt cost
  (~44 ms per hash).
- **The Postgres adapter**: schema covers all three tables with no extension
  dependency, TLS enabled for remote hosts, and all 12 query paths verified to
  have matching placeholders and parameters with no string interpolation.
- **The SMTP path** under `NODE_ENV=production`: transport resolves to `smtp`,
  port 465 selects implicit TLS, the message carries HTML and plain-text
  alternatives with the code and the recipient's name, and no code is returned
  to the browser.
- The pricing engine, the 245-country dataset, and the formatters were each
  executed against their own assertion suites.

A `npm install && npm run build` on your machine is the remaining step.
