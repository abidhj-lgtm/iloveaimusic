# I Love AI Music

A community feed for AI-generated music. Post tracks from your computer (with cover art)
or embed them from YouTube, tell the story behind each track, share the exact style prompt,
and publish the lyrics — all in an Instagram-style chronological feed with a persistent player.

## Run

    npm install
    npm run dev

Open http://localhost:3000

## Demo mode

This build runs fully self-contained in the browser (localStorage + IndexedDB) so every flow
works with zero API keys:

- Sign up with any Gmail address → the verification email arrives in the on-screen **Demo inbox**
  (no real email is sent). Click it, then log in.
- Or press **Enter the demo studio** on the login page (account: aria@gmail.com / demo1234).
- Seeded "Synth" tracks are synthesized live in your browser with the Web Audio API on first play.
- In the upload form, **Synthesize a sample** lets you publish a real, playable track without
  having an audio file on hand.

The data layer (`src/lib/store.tsx`, `src/lib/idb.ts`) is isolated so it can be swapped for
Postgres/Supabase + Auth.js + Resend later without touching the UI.