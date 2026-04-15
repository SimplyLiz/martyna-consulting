# Setup

## Required environment variables

| Variable | Purpose | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin` login. | Required. No code fallback — if unset, login always fails. |
| `SESSION_SECRET` | HMAC key that signs the admin session cookie (`claritas_admin`). | Recommended. Falls back to `ADMIN_PASSWORD` if missing, which means rotating the password invalidates all active sessions. Use a 32+ byte random hex (`openssl rand -hex 32`). |
| `RESEND_API_KEY` | Resend API key for transactional + newsletter mail. | Optional locally — without it, all `sendX()` calls become no-ops. Required in production. |
| `CRON_SECRET` | Shared secret required in the `x-cron-secret` header for `/api/cron/*`. | Optional. If unset, cron endpoints accept any call — set it in production. |
| `PUBLIC_SITE_URL` | Base URL used in newsletter + confirmation links. | Defaults to `https://claritas-ai.de`. |

`ADMIN_PASSWORD` defaults: there is none. The old `'claritas2024'` fallback was removed; set the variable explicitly.

## Local `.env`

```bash
ADMIN_PASSWORD=claritas2024        # staging / dev only
SESSION_SECRET=<openssl rand -hex 32>
RESEND_API_KEY=<from Resend dashboard>
CRON_SECRET=<openssl rand -hex 32>
```

`.env` is gitignored.

## Vercel (staging)

Currently set for **production**, **preview**, and **development** on the `taste-hub/claritas-ai-consulting` project:

- `ADMIN_PASSWORD` = `claritas2024` (weak, staging only — rotate before going live)
- `SESSION_SECRET` = random 64-char hex

Not yet set (add before going live):

- `RESEND_API_KEY`
- `CRON_SECRET`
- `PUBLIC_SITE_URL` (only if the domain differs from `claritas-ai.de`)

Manage via `vercel env ls` / `vercel env add NAME <production|preview|development>`.

## Before going live

1. Rotate `ADMIN_PASSWORD` to a strong value and update it in Vercel.
2. Rotate `SESSION_SECRET` (this invalidates all active admin sessions).
3. Add `RESEND_API_KEY` and `CRON_SECRET`.
4. Verify `vercel.json` cron schedules still match the desired cadence.

## Admin session model

- `POST /api/admin/login` with `{ password }` — on success sets `claritas_admin`, an HMAC-signed httpOnly cookie (8h TTL, `SameSite=Lax`, `Secure` in production).
- `POST /api/admin/logout` — clears the cookie.
- All `/api/admin/*` routes call `isAuthenticated(cookies)`; no headers required from the browser.
- Login is rate-limited per IP (8 attempts / 15 min, in-memory — resets on cold starts).
