import { NextRequest } from "next/server";
import { submitReport, roleFor, isStaff, ensureTrustSeeded } from "@/server/trust/service";
import { consoleQueueFast } from "@/server/trust/queue";
import { reportSchema, firstIssue } from "@/server/validation";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const role = await roleFor(viewer);
    if (!isStaff(role)) return fail("Moderator access required.", 403, "forbidden");
    await ensureTrustSeeded();
    return ok({ ...(await consoleQueueFast()), role });
  } catch (err) {
    return serverError(err, "Could not load the queue.");
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to report content.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email before reporting.", 403, "unverified");

  const limit = await rateLimit("comment", viewer.id);
  if (!limit.ok) return fail(`Report limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = reportSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await submitReport(viewer.id, parsed.data, clientIp(req));
    return res.ok ? ok({ id: res.id }) : fail(res.error!, 400, "report");
  } catch (err) {
    return serverError(err, "Could not file the report.");
  }
}