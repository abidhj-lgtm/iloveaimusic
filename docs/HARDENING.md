# Hardening slice — security fixes, correctness, and server scale

## Apply

    npm install
    npm run dev

**Delete `public/llms.txt`.** It is now a dynamic route at `src/app/llms.txt/route.ts`, and a
static file in `public/` would shadow it.

If you use Supabase, run `supabase/migrations/0005_scale.sql` after `0001`–`0004`.

---

## The four defects — fixed

### 1. Demo account no longer holds moderator powers in production
- Staff rights now come from `STAFF_EMAILS` (verified accounts only).
- `DEMO_STAFF` is force-disabled when `NODE_ENV=production`, and any existing staff grant on
  the demo profile is **actively demoted to `creator`** on the next seed pass.
- `ALLOW_DEMO_LOGIN` defaults to false in production. The demo endpoint returns 403, the
  password login path rejects the demo provider, and the login page hides the button and the
  credentials hint entirely.
- Closed accounts can no longer resolve a session or log in.

### 2. Comment removal is genuinely undoable
`Repo.restoreComment()` exists in both adapters. The moderation undo branch handles
`comment` targets, so the Undo button in the activity log now restores the comment and
recounts the track.

### 3. `trust-additions.css` is imported
Along with a new `account.css`. The report CTA, comment tools, pager and inventory styles
are live.

### 4. Comments can be reported
 one-click JSON download of profile, tracks, provenance, comments, likes,
  saves, follows, reports and strikes.
- **Close account** — type your handle to confirm. Anonymises the profile, removes tracks and
  comments, clears likes/saves/follows, revokes every session, and writes an audit entry with
  a seven-day purge timestamp.

## Admin depth

`/admin/catalog` — staff-only inventory with two tabs:
- **Tracks**: search, status filter, sort, bulk hide/remove/restore with Undo, provenance and
  open-report badges, cursor "load more".
- **Accounts**: search, sort, role/verification/closure state, track counts, strike counts.

---

## Production checklist

1. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; run migrations `0001`–`0005`.
2. Set `RESEND_API_KEY`, `MAIL_FROM` (verified domain).
3. Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
4. Set `STAFF_EMAILS` to your own verified address, then sign up and verify it.
5. Leave `ALLOW_DEMO_LOGIN` empty. Confirm `/admin` returns 403 for a normal account.
6. Delete `public/llms.txt`.

## Still outstanding

- Home feed still loads a capped window client-side; the keyset API is ready but the feed
  UI is not yet wired to infinite server paging (`/discover` is).
- No FFmpeg pipeline: no transcode, loudness normalization, waveform, quota or malware scan.
- No Sentry, uptime alerts, CI, E2E/load tests, accessibility audit or backup restore drill.
- `next.config.mjs` still ignores type/lint errors at build.