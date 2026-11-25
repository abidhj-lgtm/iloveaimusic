import { NextRequest } from "next/server";
import { getRepo, resolveTrackId } from "@/server/store";
import { ipHash } from "@/server/crypto";
import { resolveSession } from "@/server/session";
import { roleFor, isStaff } from "@/server/trust/service";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { toggleSchema, firstIssue } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id, action } = await params;
  const ip = clientIp(req);
  const viewer = await resolveSession(readSessionToken(req));
  const repo = getRepo();

  // Look the track up ONCE, before any deleted-state filtering, so restore can find soft-deleted rows.
  const realId = await resolveTrackId(id);
  const row = realId ? await repo.findTrackById(realId) : null;
  if (!realId || !row) return fail("Track not found.", 404, "notfound");

  try {
    if (action === "play") {
      const limit = await rateLimit("play", viewer?.id ?? ipHash(ip));
      if (!limit.ok) return ok({ throttled: true });
      const plays = await repo.incrementPlays(realId, 1);
      await repo.logPlay(realId, viewer?.id ?? null, ipHash(ip)).catch(() => undefined);
      return ok({ plays });
    }

    if (!viewer) return fail("Log in first.", 401, "unauthorized");
    if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

    if (action === "like" || action === "save") {
      const parsed = toggleSchema.safeParse(await readBody(req));
      if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");
      const limit = await rateLimit("react", viewer.id);
      if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");
      if (action === "like") {
        const count = await repo.setLike(viewer.id, realId, parsed.data.on);
        return ok({ likeCount: count });
      }
      await repo.setSave(viewer.id, realId, parsed.data.on);
      return ok();
    }

    if (action === "restore") {
      const role = await roleFor(viewer);
      if (row.user_id !== viewer.id && !isStaff(role)) {
        return fail("You can only restore your own tracks.", 403, "forbidden");
      }
      await repo.restoreTrack(realId);
      await repo.audit(viewer.id, "track.restore", realId, {}, ip);
      return ok({ id: row.legacy_id ?? row.id });
    }

    return fail(`Unknown action: ${action}`, 400, "action");
  } catch (err) {
    return serverError(err, "Action failed.");
  }
}