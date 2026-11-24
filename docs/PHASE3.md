# Phase 3 — the music now lives on the server

## Run

    npm install
    npm run dev

No keys required. Server data: `.data/ilistenai.json`. Media: `.data/media/`.
Delete `.data/` to reset everything (accounts, tracks, uploads).

## What now works cross-device

- Post a track on one browser, open another (or another machine on the same server) — it is there.
- Audio and cover files upload to the server, not IndexedDB. Playback streams with HTTP Range support.
- Likes, saves, follows, comments and play counts are server-authoritative and permission-checked.
- Delete is a server soft delete; Undo calls a real restore endpoint.
- The official catalog is seeded server-side once, so every visitor sees identical tracks and counts.

## The three defects, fixed

1. **Email leak** — `/api/auth/bootstrap` now returns `PublicProfile[]` (no email). Only the signed-in
   owner receives their own email via the private `user` object.
2. **Orphaned demo tracks** — on first boot the store reads `ilistenai:v2` / `v1`, and if you are logged
   in it offers "Move to server". That uploads your IndexedDB audio and covers, creates real server
   tracks owned by you, and carries your comments across. Runs once, flagged in localStorage.
3. **Dev inbox exposure** — mail is now persisted in the server store and scoped to an HTTP-only
   `ilistenai_devbox` cookie issued at signup. You only ever see mail your own browser requested.

## New endpoints

    GET    /api/tracks?sort&view&q&cursor&limit
    POST   /api/tracks
    GET    /api/tracks/:id
    PATCH  /api/tracks/:id
    DELETE /api/tracks/:id
    POST   /api/tracks/:id/like | save | play | comments | restore
    GET    /api/tracks/:id/comments
    DELETE /api/comments/:id
    POST   /api/profiles/:id/follow
    POST   /api/uploads            (multipart: kind=audio|cover, file)
    GET    /api/media/:kind/*path  (Range-aware, visibility-checked)
    POST   /api/studio/import

## Security added in this slice

- Ownership checks on every track mutation; comment deletion allowed for author, track owner, or moderator/admin.
- Verified-email gate on publishing, uploading, commenting, liking, saving, following.
- Magic-byte MIME sniffing on uploads — a renamed executable is rejected.
- 100MB audio / 8MB image caps enforced server-side.
- Original audio stays in a private bucket; served only when the track is public or you own it.
- Rate limits on publish, upload, comment, react, play, import.
- Audit entries for track create/update/delete/restore, comments, follows, uploads, imports.

## Still outstanding (honest list)

- SSR track/discover pages still read the static catalog module, so play counts there can lag the feed.
- Feed loads up to 500 tracks at boot; the cursor API exists but the UI is not yet wired to infinite server paging.
- No FFmpeg transcode/normalize/waveform yet — uploaded audio is served as-is (Phase 2).
- No reports/moderation UI, no Terms/Privacy/DMCA pages (Phase 4).
- No Sentry, uptime alerts, or E2E tests (Phase 5).
- `next.config.mjs` still ignores type/lint errors at build; turn that off during hardening.