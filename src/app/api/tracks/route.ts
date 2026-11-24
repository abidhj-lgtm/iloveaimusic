import { NextRequest } from "next/server";
import { loadFeed, createTrackForUser } from "@/server/content-service";
import { feedQuerySchema, trackSchema, firstIssue } from "@/server/validation";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, json, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = feedQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const page = await loadFeed({
      viewerId: viewer?.id ?? null,
      sort: parsed.data.sort, view: parsed.data.view,
      q: parsed.data.q, cursor: parsed.data.cursor ?? null, limit: parsed.data.limit
    });
    return json({ ok: true, ...page });
  } catch (err) {
    return serverError(err, "Could not load the feed.");
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to post music.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email before posting.", 403, "unverified");

  const ip = clientIp(req);
  const limit = await rateLimit("publish", `${viewer.id}:${ip}`);
  if (!limit.ok) return fail(`Publishing limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = trackSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    return ok(await createTrackForUser(viewer.id, parsed.data, ip));
  } catch (err) {
    return serverError(err, "Could not publish the track.");
  }
}