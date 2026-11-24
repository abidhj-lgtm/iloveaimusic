import { NextRequest } from "next/server";
import { moderate, roleFor } from "@/server/trust/service";
import { moderationSchema, firstIssue } from "@/server/validation";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");
  const role = await roleFor(viewer);

  const limit = await rateLimit("react", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = moderationSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await moderate(viewer.id, role, parsed.data, clientIp(req));
    return res.ok ? ok({ batchId: res.batchId, affected: res.affected }) : fail(res.error!, 403, "forbidden");
  } catch (err) {
    return serverError(err, "Moderation action failed.");
  }
}