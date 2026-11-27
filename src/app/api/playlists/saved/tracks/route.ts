import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { addTrackToSavedPlaylist, removeTrackFromSavedPlaylist } from "@/server/store/features";

export const dynamic = "force-dynamic";

const schema = z.object({
  trackId: z.string().min(1).max(80),
  action: z.enum(["add", "remove"])
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Invalid request.", 400, "validation");

  try {
    if (parsed.data.action === "add") {
      await addTrackToSavedPlaylist(viewer.id, parsed.data.trackId);
    } else {
      await removeTrackFromSavedPlaylist(viewer.id, parsed.data.trackId);
    }
    return ok({ success: true });
  } catch (err) {
    return serverError(err, "Could not update saved tracks.");
  }
}