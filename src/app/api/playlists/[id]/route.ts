import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { deletePlaylist, findPlaylist, playlistTrackIds, updatePlaylist } from "@/server/store/features";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  coverSeed: z.string().max(80).optional(),
  coverPalette: z.number().int().min(0).max(11).optional(),
  isPublic: z.boolean().optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (!playlist.is_public && playlist.user_id !== viewer?.id) {
      return fail("This playlist is private.", 403, "forbidden");
    }
    const trackIds = await playlistTrackIds(id);
    return ok({ playlist, trackIds, isOwner: playlist.user_id === viewer?.id });
  } catch (err) {
    return serverError(err, "Could not load the playlist.");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = await rateLimit("playlist", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = patchSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid update.", 400, "validation");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id !== viewer.id) return fail("You can only edit your own playlists.", 403, "forbidden");

    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    if (d.title !== undefined) patch.title = d.title;
    if (d.description !== undefined) patch.description = d.description;
    if (d.coverSeed !== undefined) patch.cover_seed = d.coverSeed;
    if (d.coverPalette !== undefined) patch.cover_palette = d.coverPalette;
    if (d.isPublic !== undefined) patch.is_public = d.isPublic;

    const row = await updatePlaylist(id, patch as any);
    return ok({ playlist: row });
  } catch (err) {
    return serverError(err, "Could not update the playlist.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  try {
    const playlist = await findPlaylist(id);
    if (!playlist) return fail("Playlist not found.", 404, "notfound");
    if (playlist.user_id !== viewer.id) return fail("You can only delete your own playlists.", 403, "forbidden");
    await deletePlaylist(id);
    return ok({ id });
  } catch (err) {
    return serverError(err, "Could not delete the playlist.");
  }
}