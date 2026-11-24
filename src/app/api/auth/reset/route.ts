import { NextRequest } from "next/server";
import { resetPassword } from "@/server/auth-service";
import { resetSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { clearSession, clientIp, fail, json, ok, readBody, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("reset", ip);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = resetSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await resetPassword(parsed.data.token, parsed.data.password, ip);
    return res.ok ? clearSession(ok()) : json(res, 400);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Reset failed.", 500, "server");
  }
}