# Phase 1 — Real accounts, real sessions, real database

## What changed

The browser is no longer the source of truth for identity.

| Before (demo) | Now (Phase 1) |
|---|---|
| Accounts in localStorage | Accounts in a server store (local JSON or Postgres) |
| SHA-256 password hash in the browser | scrypt (N=16384) hashing, server-only |
| Fake client-side inbox | Server-issued single-use tokens; dev inbox or real Resend email |
| No sessions | 32-byte random tokens, SHA-256 hashed at rest, HTTP-only SameSite cookie, 30-day expiry, revocable |
| No password reset | Single-use reset link, 1-hour expiry, revokes all other sessions |
| Mock Google chooser | Real Google OAuth 2.0 authorization-code flow with state cookie |
| No abuse controls | Per-IP rate limits on signup/login/resend/forgot/reset/demo/profile, same-origin checks on every mutation |
| No audit trail | Audit log for signup, login, failed login, verification, reset, logout, profile edits |

Tracks, likes, comments, saves, follows and player preferences still live in the browser.
That is intentional: Phase 2 moves uploads to signed cloud storage, Phase 3 moves the feed
to server-rendered Postgres queries. The UI does not change when those swap in.

## Run it (no keys needed)

    npm install
    npm run dev

Open http://localhost:3000

- Sign up with any email → the verification link appears in the **Server dev inbox** on /verify
- Or press **Enter the demo studio** (aria@gmail.com / demo1234)
- Forgot password → /forgot → link appears in the same dev inbox → /reset

Server data lives at `.data/ilistenai.json` (gitignored). Delete that file to reset all accounts.

## Go to real Postgres + real email

1. Create a Supabase project.
2. In the SQL editor run, in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_security.sql`
3. Copy `.env.example` to `.env.local` and set:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`, `MAIL_FROM` (verified sending domain)
   - `NEXT_PUBLIC_SITE_URL` to your real origin
4. Restart. The login page footer now reads "Accounts stored in Postgres".

## Turn on Google sign-in

1. Google Cloud Console → OAuth client ID (Web application).
2. Authorized redirect URI: `{NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, restart.
4. The Google button appears automatically.

## Security model

The browser never talks to Postgres. Every query runs in server code with the service role,
which performs explicit ownership checks. RLS is enabled and forced on every table with
`anon` and `authenticated` revoked, so a leaked client key exposes nothing. Policies are
written for a future move to Supabase Auth.

Original audio buckets are private; only derivatives (streams, covers, avatars) are public.

## Production guard

If `NODE_ENV=production` and either the database or email is unconfigured, the server raises
a clear configuration error instead of silently writing to ephemeral disk.

## Next phases

- **Phase 2** — signed uploads, private buckets, FFmpeg validation/transcode/normalize/waveform, processing status UI
- **Phase 3** — server-rendered feed from Postgres, cursor pagination, real likes/comments/saves/follows, buffered play counts
- **Phase 4** — reports, moderation queue, rights attestation, licences, takedowns, legal pages
- **Phase 5** — E2E tests, load tests, Sentry, uptime alerts, backup restore drill