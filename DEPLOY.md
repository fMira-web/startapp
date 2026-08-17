# Deployment

Two services: the React frontend on **Vercel**, the Express API plus Postgres
on **Render**. Do Render first — the frontend needs the API's URL at build time.

Everything below assumes the project is in one Git repository with this layout:

```
/                 frontend (package.json, src/, index.html)
/backend          the API
/render.yaml      Render Blueprint — must stay at the repo root
/vercel.json      Vercel config
```

---

## 0. Put it in a repository

```bash
cd proposal
git init
git add .
git commit -m "Proposal experience"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.gitignore` files are already in place for both halves — `node_modules`, `dist`
and `.env` stay out. **Never commit a real `.env`.**

---

## 1. Render — database and API

### The easy path: Blueprint

Render dashboard → **New** → **Blueprint** → pick the repository. It reads
`render.yaml` from the root and creates both the Postgres instance and the web
service, wires `DATABASE_URL` between them, and generates `JWT_SECRET`.

You will be asked for the values marked `sync: false`. Fill in:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | your Vercel URL — exact, **no trailing slash** |
| `MAIL_FROM` | `Your Name <you@gmail.com>` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `you@gmail.com` |
| `SMTP_PASS` | the 16-character App Password |
| `SMTP_SECURE` | `true` |

Leave `RESEND_API_KEY` empty when using SMTP — Resend wins if both are set.

You do not have the Vercel URL yet. Put a placeholder now and correct it in
step 3; the API works immediately, only the browser is blocked until it matches.

### Plans

`render.yaml` asks for `basic-256mb` (database) and `starter` (service). For a
first look, change both to `free` — the free service sleeps after 15 minutes of
inactivity, so the first request afterwards takes ~30 seconds, and free Postgres
expires after 30 days. Nothing in the code depends on the plan.

### The manual path

If you would rather click through it: create the Postgres instance first, then
**New → Web Service** with

- **Root directory**: `backend`
- **Build command**: `npm ci --omit=dev`
- **Start command**: `npm start`
- **Health check path**: `/health`

and add the variables above plus `DATABASE_URL` (Internal Database URL from the
Postgres instance), `JWT_SECRET` (any 64-character hex string:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and
`NODE_ENV=production`.

### Check it

```
https://<your-service>.onrender.com/health
```

Expected:

```json
{ "status": "ok", "storage": "postgres", "emailMode": "smtp" }
```

If `storage` says `memory`, `DATABASE_URL` did not arrive — the service will
have refused to start in production, so check the logs. If `emailMode` says
`dev`, no mail transport is configured.

---

## 2. Vercel — frontend

Import the repository. Vercel detects Vite; the committed `vercel.json` already
sets the SPA rewrite, asset caching and security headers, so accept the defaults.

Add one environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-service>.onrender.com` |

Then deploy.

**Vite inlines environment variables at build time.** Changing this variable
later does nothing until you redeploy.

---

## 3. Close the loop

Copy the Vercel production URL and set it as `ALLOWED_ORIGINS` on Render, exactly:

```
https://your-project.vercel.app
```

No trailing slash, no path, `https://` included. Render restarts automatically.

If you also use a custom domain, list both, comma-separated:

```
https://your-project.vercel.app,https://proposal.yourdomain.com
```

---

## 4. Verify end to end

1. Open the Vercel URL — the sign-in screen appears.
2. **Create one** → register with a real address.
3. The six-digit code arrives in that inbox (check spam on the first send).
4. Enter it — the proposal opens.
5. Toggle a few options, move a slider, watch the total roll.
6. **Accept & Sign Proposal** → the confirmation block appears.
7. Reload — you are still signed in, and the acceptance is still recorded.

---

## Static demo, no backend at all

To publish a clickable preview without Render or a database, deploy the frontend
alone with:

```
VITE_DEMO_MODE=1
```

Every API call is then answered in the browser by `src/lib/demoApi.js`:
registration, the verification code (shown on screen instead of emailed), sign
in, acceptance. A banner states plainly that it is a demo. Accounts live in
memory and vanish on reload. Never set this on a real deployment.

---

## Things that will bite

| Symptom | Cause |
|---|---|
| Sign-in seems to work, then reload signs you out | `ALLOWED_ORIGINS` does not match the browser's origin exactly — the cross-site cookie is dropped |
| "Could not reach the server" | `VITE_API_BASE_URL` wrong, or the free Render service is waking up |
| Changed the API URL, nothing happened | Vite inlines it at build time — redeploy |
| No email arrives | Gmail needs an **App Password**, not the account password; 2FA must be on |
| Everyone signed out after a deploy | `JWT_SECRET` changed |
| Codes rejected right after a restart | Same cause — the secret keys the code digests too |
| Gmail stops sending | ~500 messages/day cap. Move to a domain on Resend or SES |

---

## Backend environment reference

Full annotated list: `backend/.env.example`. The short version:

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://...        # from Render
JWT_SECRET=<64 hex chars>          # sessions + code digests
ALLOWED_ORIGINS=https://your-project.vercel.app

# email — Resend OR SMTP, not both
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=<app password>
SMTP_SECURE=true
MAIL_FROM=Your Name <you@gmail.com>
```
