import { NextRequest } from "next/server";
import { assertTrackOwner, resolveTrackId } from "@/server/content-service";
import { commentSchema, toggleSchema, firstIssue } from "@/server/validation";
import { getRepo, toClientComment } from "@/server/store";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { hashIp } from "@/server/crypto";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; action: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id, action } = await params;
  const ip = clientIp(req);
  const viewer = await resolveSession(readSessionToken(req));
  const realId = await resolveTrackId(id);
  if (!realId) return fail("Track not found.", 404, "notfound");
  const repo = getRepo();
  const row = await repo.findTrackById(realId);
  if (!row || row.deleted_at) return fail("Track not found.", 404, "notfound");

  try {
    if (action === "play") {
      const limit = await rateLimit("play", viewer?.id ?? hashIp(ip));
      if (!limit.ok) return ok({ throttled: true });
      const plays = await repo.incrementPlays(realId, 1);
      await repo.logPlay(realId, viewer?.id ?? null, hashIp(ip)).catch(() => undefined);
      return ok({ plays });
    }

    if (!viewer) return fail("Log in to do that.", 401, "unauthorized");
    if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

    if (action === "restore") {
      const owned = await assertTrackOwner(id, viewer.id);
      if ("error" in owned) return fail(owned.error, owned.status, "forbidden");
      await repo.restoreTrack(realId);
      await repo.audit(viewer.id, "track.restore", realId, {}, ip);
      return ok();
    }

    if (action === "like" || action === "save") {
      const limit = await rateLimit("react", viewer.id);
      if (!limit.ok) return fail(`Slow down a moment. Try again in ${limit.retryAfter}s.`, 429, "rate");
      const parsed = toggleSchema.safeParse(await readBody(req));
      if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");
      if (action === "like") return ok({ likeCount: await repo.setLike(viewer.id, realId, parsed.data.on), on: parsed.data.on });
      await repo.setSave(viewer.id, realId, parsed.data.on);
      return ok({ on: parsed.data.on });
    }

    if (action === "comments") {
      const limit = await rateLimit("comment", viewer.id);
      if (!limit.ok) return fail(`Comment limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");
      const parsed = commentSchema.safeParse(await readBody(req));
      if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");
      const created = await repo.addComment(realId, viewer.id, parsed.data.text);
      await repo.audit(viewer.id, "comment.create", created.id, { track: realId }, ip);
      return ok({ comment: toClientComment(created, viewer.legacy_id ?? viewer.id, row.legacy_id ?? row.id) });
    }

    return fail("Unknown action.", 404, "notfound");
  } catch (err) {
    return serverError(err, "Action failed.");
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, action } = await params;
  if (action !== "comments") return fail("Unknown action.", 404, "notfound");
  const realId = await resolveTrackId(id);
  if (!realId) return fail("Track not found.", 404, "notfound");
  try {
    const repo = getRepo();
    const [comments, profiles, row] = await Promise.all([repo.commentsForTracks([realId]), repo.listProfiles(), repo.findTrackById(realId)]);
    const pub = new Map(profiles.map((p) => [p.id, p.legacy_id ?? p.id]));
    return ok({ comments: comments.map((c) => toClientComment(c, pub.get(c.user_id) ?? c.user_id, row?.legacy_id ?? realId)) });
  } catch (err) {
    return serverError(err, "Could not load comments.");
  }
}