# Things to Do Before Launch

Status snapshot before going live with claritas-ai.de (or whichever domain).

---

## 1. Email delivery — pick Resend *or* SMTP

The app currently uses **Resend** via `src/lib/email.ts`. All outbound mail (appointment confirmations, rejections, reschedules, admin messages, daily digest, newsletter welcome, newsletter sends) flows through the same `Resend` client, gated by `RESEND_API_KEY`. If the key is absent, `sendXxx()` functions silently no-op — the site still works, but no mail goes out.

### Option A — Resend (recommended, easiest)

1. Create account at https://resend.com and verify the sending domain (`claritas-ai.de`).
   - Add the DKIM + SPF + MX (for return path) DNS records Resend provides.
   - Wait for domain status → "Verified".
2. Generate an API key.
3. Set env vars (Vercel project settings, or Hetzner `.env`):
   ```
   RESEND_API_KEY=re_xxx
   ```
4. Confirm `FROM_EMAIL` in `src/lib/email.ts:4` matches the verified domain — currently `noreply@claritas-ai.de`. Change if the domain is different.
5. Send a test: subscribe a real mailbox via the footer form; welcome email should arrive.

### Option B — SMTP on Hetzner (self-hosted or relay)

Resend's SDK is SMTP-incompatible. Switching means replacing `src/lib/email.ts` to use `nodemailer`.

1. `npm install nodemailer` and `npm install -D @types/nodemailer`.
2. Rewrite `src/lib/email.ts` to use a `nodemailer.createTransport({ host, port, secure, auth: { user, pass } })` instead of the Resend client — all the public functions (`sendConfirmationEmail`, `sendNewsletterToSubscriber`, etc.) stay, only the internal `resend.emails.send(...)` calls swap to `transport.sendMail(...)`.
3. Pick an SMTP source:
   - **Hetzner's own mail** (Konsoleh / mailbox.org via Hetzner) — cheapest, but deliverability to Gmail/Outlook is mediocre unless DKIM/SPF/DMARC are tight.
   - **External relay** (Mailgun, Postmark, Brevo, SendGrid) — recommended for transactional + newsletter reliability.
4. Env vars:
   ```
   SMTP_HOST=...
   SMTP_PORT=587
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_FROM="Claritas AI Consulting <noreply@claritas-ai.de>"
   ```
5. DNS: SPF (`v=spf1 include:<provider> ~all`), DKIM (provider-specific), DMARC (`v=DMARC1; p=quarantine; rua=mailto:...`).

**Recommendation:** stay on Resend unless there's a specific reason (cost at scale, EU data-residency concerns) to move. Resend has an EU region and clean API.

---

## 2. Hosting — Vercel *or* Hetzner

The project is configured for both: `astro.config.mjs` uses `@astrojs/vercel`, and `@astrojs/node` is already installed for a Hetzner/standalone deploy.

### Option A — Vercel (current config, fastest path)

**Pros:** zero-config deploy from git, automatic HTTPS, cron jobs already wired in `vercel.json`, OG image generation via `@vercel/og` works natively.

**Cons:** `data/*.json` files are **not persistent** on Vercel serverless — `src/lib/storage.ts` writes to `/tmp/claritas-data`, which is ephemeral per cold start. Appointments, subscribers, scheduled newsletters, and page views **will be lost** unexpectedly.

Steps:
1. Push repo to GitHub.
2. Import in Vercel, point to the `master` branch.
3. Set env vars in Vercel project settings:
   - `RESEND_API_KEY`
   - `ADMIN_PASSWORD` (default fallback is `claritas2024` — override)
   - `CRON_SECRET` (random string; used by `/api/cron/*` to reject unauthorized calls)
   - `PUBLIC_SITE_URL=https://claritas-ai.de` (used to build unsubscribe links in newsletter emails)
4. Configure custom domain in Vercel + update DNS A/CNAME.
5. **Before any real user data goes in, migrate storage off JSON files.** Two options:
   - Vercel KV (Redis) or Vercel Blob — swap implementations inside `src/lib/storage.ts` only.
   - External DB (Neon/Postgres, Turso/SQLite, Supabase) — bigger change, better long-term.

### Option B — Hetzner (VPS, persistent disk)

**Pros:** `data/*.json` persists across restarts; full control; cheap; EU-hosted (good for DSGVO optics).

**Cons:** manual TLS, reverse proxy, process supervision, OS patching. Cron is system cron, not `vercel.json`.

Steps:
1. Switch the adapter in `astro.config.mjs`:
   ```js
   import node from '@astrojs/node';
   export default defineConfig({
     output: 'server',
     adapter: node({ mode: 'standalone' }),
   });
   ```
2. Remove `@vercel/og` usage or keep it (it runs fine under Node; just heavier).
3. On the Hetzner box (Debian/Ubuntu):
   - Install Node 22+ and a reverse proxy (Caddy or nginx).
   - Clone repo, `npm ci`, `npm run build` → produces `dist/server/entry.mjs`.
   - Run under `systemd` (or pm2):
     ```
     [Service]
     WorkingDirectory=/opt/claritas
     Environment=PORT=4321
     Environment=HOST=127.0.0.1
     EnvironmentFile=/opt/claritas/.env
     ExecStart=/usr/bin/node ./dist/server/entry.mjs
     Restart=always
     ```
   - Caddy terminates TLS and proxies to `127.0.0.1:4321`:
     ```
     claritas-ai.de {
       reverse_proxy 127.0.0.1:4321
     }
     ```
4. System cron replaces `vercel.json` crons:
   ```
   0 10 * * *  curl -s -H "x-cron-secret: $CRON_SECRET" https://claritas-ai.de/api/cron/daily-digest
   */15 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://claritas-ai.de/api/cron/send-scheduled
   ```
5. `.env` on the server:
   ```
   RESEND_API_KEY=...            (or SMTP_* if you went that route)
   ADMIN_PASSWORD=...
   CRON_SECRET=...
   PUBLIC_SITE_URL=https://claritas-ai.de
   ```
6. Back up `/opt/claritas/data/` regularly (it holds appointments, subscribers, newsletters, page views).

**Recommendation:** Hetzner is the better fit for this app as-is, because the JSON-file storage becomes a real persistence story instead of ephemeral `/tmp`. If simplicity matters more than data persistence, go Vercel and plan a KV/DB migration.

---

## 3. What's still left to wire up

### Required before launch
- [ ] Choose and verify email provider (Section 1).
- [ ] Choose host, deploy, wire domain + TLS (Section 2).
- [ ] Set env vars: `RESEND_API_KEY` (or SMTP_*), `ADMIN_PASSWORD`, `CRON_SECRET`, `PUBLIC_SITE_URL`.
- [ ] Confirm `FROM_EMAIL` / sender domain in `src/lib/email.ts:4` matches the verified mail domain.
- [ ] Update `siteUrl` in `src/layouts/Layout.astro:18` — currently hard-coded to `https://claritas-ai-consulting.vercel.app`; should be the production domain.
- [ ] Update `ADMIN_EMAIL` in `src/lib/email.ts:5` — currently `martyna@tastehub.io`; confirm this is the right inbox for the daily digest.
- [ ] Set a strong `ADMIN_PASSWORD` (default fallback `claritas2024` is in code as a dev convenience).
- [ ] Smoke-test end to end:
  - [ ] Book an appointment → email arrives, admin sees it, confirm/reject/reschedule each send correct emails.
  - [ ] Subscribe to newsletter in DE / EN / PL → welcome email in correct language arrives.
  - [ ] Admin composes newsletter → "Jetzt senden" delivers to a test subscriber.
  - [ ] Admin schedules newsletter for +5 min → cron fires, status flips to `sent`.
  - [ ] Unsubscribe link in newsletter footer works.
  - [ ] Contact form submits, lands in `contacts.ndjson`.

### Known data-persistence gap
- [ ] Replace JSON-file storage with a real datastore if going to Vercel (see Section 2A). Otherwise, on Hetzner, add automated backups of `data/` (nightly rsync or `restic` to Hetzner Storage Box).

### Legal / DSGVO
- [ ] Newsletter signup currently has **no double-opt-in**. For EU DSGVO compliance this is typically required — the welcome email should contain a confirmation link the user must click before their status becomes `active`. Not yet implemented; needs a token-based confirm flow similar to the unsubscribe flow.
- [ ] `/datenschutz` should mention newsletter processing: what's stored (email, language, timestamp), lawful basis (consent), retention, unsubscribe rights, processor (Resend/SMTP provider) with their DPA.
- [ ] Add newsletter consent checkbox + link to Datenschutz on the footer signup form (one-line change in `src/components/Footer.astro`).

### Nice-to-have (not launch-blocking)
- [ ] Rate-limit `/api/newsletter/subscribe` and `/api/contact` (simple IP-based throttle).
- [ ] Add a honeypot field or basic CAPTCHA to both forms.
- [ ] Newsletter admin: add an HTML preview / "send test to me" button before blasting the list.
- [ ] Newsletter admin: pagination for subscribers list (current UI caps at 360px scroll).
- [ ] Observability: pipe `console.error` from `/api/*` into Sentry or similar.
- [ ] Pre-existing warning in `src/pages/admin/metrics/index.astro:109` — `daysInMonth` reassignment of a `const`. Not fatal (JS engines tolerate it post-bundling via hoisting quirks), but worth fixing: change `const` → `let`.
