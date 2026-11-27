import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { getOrCreateSavedPlaylist } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  try {
    const playlistId = await getOrCreateSavedPlaylist(viewer.id);
    return ok({ playlistId });
  } catch (err) {
    return serverError(err, "Could not get saved playlist.");
  }
}