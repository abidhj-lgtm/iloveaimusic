import { NextRequest } from "next/server";
import { updateProfile } from "@/server/auth-service";
import { profileSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, json, ok, readBody, readSessionToken, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("profile", ip);
  if (!limit.ok) return fail(`Slow down a moment. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = profileSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await updateProfile(readSessionToken(req), parsed.data, ip);
    if (!res.ok) return json(res, res.code === "unauthorized" ? 401 : 400);
    return ok({ user: res.user });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Profile update failed.", 500, "server");
  }
}