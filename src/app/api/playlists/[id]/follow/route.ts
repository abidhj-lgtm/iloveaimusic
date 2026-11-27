import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { findPlaylist, followPlaylist, unfollowPlaylist, isFollowingPlaylist, followerCount } from "@/server/store/features";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["follow", "unfollow"])
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Invalid action.", 400, "validation");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id === viewer.id) return fail("You can't follow your own playlist.", 400, "self");
    if (!playlist.is_public) return fail("This playlist is private.", 403, "forbidden");

    if (parsed.data.action === "follow") {
      await followPlaylist(viewer.id, id);
    } else {
      await unfollowPlaylist(viewer.id, id);
    }

    const isFollowing = await isFollowingPlaylist(viewer.id, id);
    const count = await followerCount(id);
    return ok({ isFollowing, followerCount: count });
  } catch (err) {
    return serverError(err, "Could not update follow status.");
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return ok({ isFollowing: false, followerCount: 0 });

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");

    const isFollowing = await isFollowingPlaylist(viewer.id, id);
    const count = await followerCount(id);
    return ok({ isFollowing, followerCount: count });
  } catch (err) {
    return serverError(err, "Could not load follow status.");
  }
}