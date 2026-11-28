# Slice 1 — brand, safety & correctness

## Run

    npm install
    npm run dev

Then run the new migration if you are on Supabase:
`supabase/migrations/0005_atomic.sql`

## What changed

**Brand — I Love AI Music**
Display name, logo (heart + waveform), favicon, OG images, mail templates and subjects,
SEO metadata, JSON-LD (`alternateName` keeps "I Love AI Music" for entity continuity),
legal documents, and `llms.txt`. Domain `iloveaimusic.com`, handle `@iloveaimusic`,
contacts `hello@` / `legal@` / `moderation@iloveaimusic.com`.

Technical identifiers deliberately unchanged: cookie names, `.data/` filenames, the
`ilistenai` package/folder slug. Nobody sees those, and changing them would log everyone
out and orphan local studios.

**Security — the demo-admin hole is closed**
Staff rights now come from `STAFF_EMAILS` only. In production the demo account is
explicitly demoted to `creator`, and any stored admin override for a non-allowlisted
email is ignored. Set `STAFF_EMAILS=you@iloveaimusic.com` before deploying.

**Build-breaking bug fixed**
`rights-panel.tsx` and `admin-console.tsx` were importing constants from a `server-only`
module. Those constants now live in `src/lib/rights-options.ts`, which is client-safe.
`admin-console.tsx` needs its import changed to:
`import { LICENSES, AI_TOOLS } from "@/lib/rights-options";`

**Comment reporting**
Flag action on every comment in the feed drawer and track page. Hidden until hover on
desktop, always visible on touch. Own comments show delete instead.

**Comment undo actually works**
`restoreComment` added to both adapters; the moderation undo branch now handles comments.
Supabase uses the `restore_comment` RPC with a REST fallback.

**Atomic play counts**
`increment_plays` RPC removes the read-modify-write race. Falls back to the old path if
the migration hasn't been run yet.

**Media authorisation at any scale**
`/api/media/audio/*` now does a direct `findTrackByAudioPath` lookup instead of scanning a
500-item feed slice. Public tracks beyond that window no longer 403.

**Free-tier safety net**
`GET /api/backup?token=…` returns a restorable JSON snapshot (password hashes excluded).
`GET /api/health` reports DB mode, email mode, latency — point your uptime monitor here.

## Free tier: what you are accepting

- **No point-in-time recovery.** Mitigation: schedule `/api/backup` daily and keep the
  files. Media is not in the snapshot — back up the storage buckets separately.
- **Projects pause after ~7 days idle.** Mitigation: ping `/api/health` every few days.
- **500MB database, 1GB storage, 5GB egress/month.** Audio egress is the one to watch.
- Rate limits need Upstash, or they reset on every serverless cold start.

## Still outstanding after Slice 1

- `next.config.mjs` still ignores type/lint errors at build. Turning that off surfaces a
  batch of errors across ~100 files; it needs its own pass, not a blind flip.
- No E2E suite yet (would add a Playwright dependency).
- Feed still capped client-side; sitemap/discover/profile discography still static.
- No FFmpeg pipeline, no account deletion/export UI, no Sentry.

## Next

Slice 2 — go live: Supabase project, migrations 0001–0005, Resend domain verification,
Upstash, Google OAuth redirect on iloveaimusic.com, Vercel deploy, uptime monitor on
/api/health, first backup + restore drill.