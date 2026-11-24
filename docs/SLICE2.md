# Slice 2 — production survival

## Apply

    npm install
    npx playwright install chromium

Run `supabase/migrations/0006_scale.sql` in the SQL Editor.

**Delete `public/llms.txt`** — it is now a dynamic route and the static file would shadow it.

## What changed

**Round trips removed**
- `countTracks` / `countPublicTracks` use `Prefer: count=exact` and read `Content-Range`. One row transferred instead of every id.
- Catalog seeding is guarded by an `app_meta` marker plus an in-process promise. It no longer scans on every request.
- `feed()` fetches `limit + 1` and returns `hasMore`. The second full-table count query is gone.
- **True keyset pagination** on `(sort_key, id)` with matching partial indexes. No offset scans.
- `profilesByIds`, `tracksByIds`, `tracksForUsers` replace every N+1 loop.
- `loadViewerCollections` is now 5 queries total regardless of how many likes you have.
- The moderation queue moved to `trust/queue.ts`: 4 queries total, not one per artist.

**Everything indexable**
`sitemap.xml`, `feed.xml`, `llms.txt`, `/discover` and profile discographies all read the live database through `publicCatalog()`. New user tracks now appear in the sitemap.

**Observability**
- `observability.ts`: structured JSON logs with request ids, secret redaction, slow-query warnings.
- Sentry via the envelope API over `fetch` — no SDK dependency. Set `SENTRY_DSN` to enable.
- `ErrorReporter` catches browser errors and rejections; `error.tsx` reports boundary failures.
- Every error response carries a `requestId` you can grep in logs.
- `/api/health` now checks the DB and Redis, and lists configuration warnings.

**Free-tier safety net**
`backup.yml` pings health daily (prevents the 7-day idle pause) and stores a 90-day snapshot artifact.

**Smoke suite**
`tests/smoke.spec.ts` runs the full journey in an isolated local-mode server on port 3100 with its own `.data-e2e` directory. It never touches your Supabase project.

    npm run test:e2e

## Resend — real verification email (~15 min)

1. https://resend.com → sign up → **Domains** → **Add Domain** → `iloveaimusic.com`
2. Resend shows 3–4 DNS records. At your registrar add each one exactly:
   - **TXT** on `send` (SPF)
   - **TXT** on `resend._domainkey` (DKIM)
   - **MX** on `send`
   - optional **TXT** on `_dmarc`
3. Click **Verify**. Usually 5–30 minutes; sometimes an hour.
4. **API Keys** → **Create API Key** → sending access → copy.
5. In `.env.local`:
   RESEND_API_KEY=re_xxxxx
   MAIL_FROM="I Love AI Music <no-reply@iloveaimusic.com>"
6. Restart. `/api/health` should show `"email":"resend"`.
7. Sign up with a real address and confirm the mail arrives.

## Upstash — rate limits that survive cold starts (~5 min)

1. https://console.upstash.com → sign up → **Redis** → **Create database**
2. Name `iloveaimusic`, region closest to your Supabase region, **Free** plan
3. Open the database → **REST API** section → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Paste both into `.env.local`, restart
5. `/api/health` should show `"rateLimit":"upstash"` and `checks.redis.ok: true`

## GitHub secrets for the backup workflow

Repo → Settings → Secrets and variables → Actions → New repository secret:
- `SITE_URL` = `https://iloveaimusic.com`
- `BACKUP_TOKEN` = the same value as in your env

## Still outstanding

- `ignoreBuildErrors` still on. `npm run typecheck` shows the real count; CI reports it without blocking.
- No FFmpeg pipeline, no account deletion/export UI, no admin track/user lists.
- No formal accessibility audit.