import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { clientIp, fail, ok, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to do that.", 401, "unauthorized");
  try {
    const repo = getRepo();
    const comment = await repo.findComment(id);
    if (!comment) return fail("Comment not found.", 404, "notfound");
    const track = await repo.findTrackById(comment.track_id);
    const allowed = comment.user_id === viewer.id || track?.user_id === viewer.id || viewer.role === "admin" || viewer.role === "moderator";
    if (!allowed) return fail("You can only remove your own comments.", 403, "forbidden");
    await repo.softDeleteComment(id);
    await repo.audit(viewer.id, "comment.delete", id, { track: comment.track_id }, clientIp(req));
    return ok();
  } catch (err) {
    return serverError(err, "Could not delete the comment.");
  }
}