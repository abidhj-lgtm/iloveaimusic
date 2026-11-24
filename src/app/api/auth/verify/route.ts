import { NextRequest } from "next/server";
import { verifyEmail } from "@/server/auth-service";
import { tokenSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, json, ok, readBody, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("verify", ip);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = tokenSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await verifyEmail(parsed.data.token, ip);
    return res.ok ? ok({ user: res.user }) : json(res, 400);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Verification failed.", 500, "server");
  }
}