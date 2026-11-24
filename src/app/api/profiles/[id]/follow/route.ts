import { NextRequest } from "next/server";
import { getRepo, resolveProfileId } from "@/server/store";
import { resolveSession } from "@/server/session";
import { toggleSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to follow artists.", 401, "unauthorized");

  const limit = await rateLimit("react", viewer.id);
  if (!limit.ok) return fail(`Slow down a moment. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = toggleSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  const target = await resolveProfileId(id);
  if (!target) return fail("Artist not found.", 404, "notfound");
  if (target === viewer.id) return fail("You can't follow yourself.", 400, "self");

  try {
    await getRepo().setFollow(viewer.id, target, parsed.data.on);
    await getRepo().audit(viewer.id, parsed.data.on ? "follow.add" : "follow.remove", target, {}, clientIp(req));
    return ok({ on: parsed.data.on });
  } catch (err) {
    return serverError(err, "Could not update follow.");
  }
}