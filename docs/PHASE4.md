# Phase 4 — Trust, rights, moderation and legal

## Run

    npm install
    npm run dev

No new dependencies. No keys required.

## Try it in this order

1. **Log in as the demo studio** (`aria@gmail.com` / `demo1234`). That account is seeded with
   moderator rights, so the staff console is reachable immediately.
2. Open **/admin**. It opens already populated with seven believable reports across every
   reason category and every status, plus provenance records and an activity log.
   - Switch saved views: Open queue · Copyright · Spam & abuse · Resolved · Everything
   - Search, sort, select-all, bulk hide / remove / dismiss / mark-reviewing
   - Open **Review** for the detail drawer: reporter statement, provenance on record,
     resolution note, and per-target actions
   - Every destructive action raises an **Undo** toast that reverts the whole batch
   - **Artists & strikes** issues strikes; **Activity log** replays and reverts any batch
3. Open any track page → new **Rights & provenance** section.
   - As the owner you get a full editor: licence, AI tool, human contribution, explicit,
     third-party samples, monetisation, distribution, and the attestation checkbox.
   - As a visitor you see the badges and a **Report this track** action.
4. Post a track at **/create** — step 6 now requires an explicit rights attestation before
   publishing, and the publish toast deep-links to the provenance panel.
5. Read **/legal/terms**, **/legal/privacy**, **/legal/dmca**.

## What is now real

- Reports are stored server-side, deduplicated per reporter/target, rate-limited, and
  restricted to verified accounts. You cannot report your own track.
- Moderation is role-gated (`admin` / `moderator`), batched, and fully audited. Hide, remove,
  restore, dismiss, mark-reviewing and strike all write to `moderation_actions` with the
  prior state, so **undo restores exactly what was there before**.
- Provenance is a real record per track: licence, AI tool, human contribution, explicit flag,
  sample declaration, monetisation and distribution consent — mirrored onto the track row.
- Three complete legal documents with real, specific copy, JSON-LD, and cross-links.

## Storage

Local mode adds `.data/trust.json`. Supabase mode uses `reports`, `track_rights`,
`user_strikes`, `moderation_actions`, `staff_roles` — run `0004_trust.sql` after the earlier
migrations.

## Still outstanding

- Feed/discover/sitemap still read the static catalog for SSR; server tracks appear in the
  client feed but are not yet in the sitemap.
- No FFmpeg pipeline, no account export/deletion UI, no Sentry/uptime/E2E yet.