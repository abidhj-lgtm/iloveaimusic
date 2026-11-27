import { NextRequest } from "next/server";
import { resolveTrackId } from "@/server/store";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { findPlaylist, removeTrackFromPlaylist } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id, trackId } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id !== viewer.id) return fail("You can only edit your own playlists.", 403, "forbidden");

    const realId = await resolveTrackId(trackId);
    if (!realId) return fail("Track not found.", 404, "notfound");

    await removeTrackFromPlaylist(id, realId);
    return ok({ removed: true, trackId: realId });
  } catch (err) {
    return serverError(err, "Could not remove the track.");
  }
}