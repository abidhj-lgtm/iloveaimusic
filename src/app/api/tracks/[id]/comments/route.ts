import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError, clientIp } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { getRepo } from "@/server/store";
import { notify } from "@/server/store/features";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().trim().min(1).max(1000)
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");
  
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = await rateLimit("comment", viewer.id);
  if (!limit.ok) return fail(`Comment limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Invalid comment text.", 400, "validation");

  try {
    const repo = getRepo();
    const track = await repo.findTrackById(id);
    if (!track || track.deleted_at || track.visibility !== "public") {
      return fail("Track not found.", 404, "notfound");
    }

    const comment = await repo.createComment({
      track_id: id,
      user_id: viewer.id,
      text: parsed.data.text
    });

    // Notify track owner
    if (track.user_id !== viewer.id) {
      await notify({
        userId: track.user_id,
        kind: "comment",
        actorId: viewer.id,
        trackId: id,
        commentId: comment.id
      });
    }

    return ok({ comment });
  } catch (err) {
    return serverError(err, "Could not post comment.");
  }
}