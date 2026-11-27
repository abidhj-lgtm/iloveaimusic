import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { findPlaylist, playlistTrackIds, reorderPlaylist } from "@/server/store/features";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
  trackIds: z.array(z.string().min(1).max(80)).min(1).max(200)
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = await rateLimit("playlist", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = reorderSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Send the full track order.", 400, "validation");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id !== viewer.id) return fail("You can only reorder your own playlists.", 403, "forbidden");

    await reorderPlaylist(id, parsed.data.trackIds);
    const trackIds = await playlistTrackIds(id);
    return ok({ trackIds });
  } catch (err) {
    return serverError(err, "Could not reorder the playlist.");
  }
}