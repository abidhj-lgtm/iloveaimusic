import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepo, resolveTrackId } from "@/server/store";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { addTrackToPlaylist, findPlaylist, notify, playlistTrackIds } from "@/server/store/features";

export const dynamic = "force-dynamic";

const addSchema = z.object({ trackId: z.string().min(1).max(80) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

  const limit = await rateLimit("playlist", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = addSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Pick a track to add.", 400, "validation");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id !== viewer.id) return fail("You can only add to your own playlists.", 403, "forbidden");

    const current = await playlistTrackIds(id);
    if (current.length >= 200) return fail("A playlist holds at most 200 tracks.", 400, "quota");

    const repo = getRepo();
    const realId = await resolveTrackId(parsed.data.trackId);
    const track = realId ? await repo.findTrackById(realId) : null;
    if (!track || track.deleted_at) return fail("Track not found.", 404, "notfound");
    if (track.status !== "published" || track.visibility !== "public") {
      return fail("That track is not publicly available.", 400, "unavailable");
    }

    const added = await addTrackToPlaylist(id, realId!);
    if (!added) return ok({ alreadyThere: true, trackId: realId });

    if (track.user_id !== viewer.id) {
      await notify({ userId: track.user_id, kind: "playlist_add", actorId: viewer.id, trackId: realId, playlistId: id });
    }
    return ok({ added: true, trackId: realId });
  } catch (err) {
    return serverError(err, "Could not add the track.");
  }
}