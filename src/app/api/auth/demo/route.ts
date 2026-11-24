import { NextRequest } from "next/server";
import { demoLogin } from "@/server/auth-service";
import { rateLimit } from "@/server/ratelimit";
import { attachSession, clientIp, fail, ok, sameOrigin, userAgent } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("demo", ip);
  if (!limit.ok) return fail(`Too many demo sessions. Try again in ${limit.retryAfter}s.`, 429, "rate");
  try {
    const res = await demoLogin(ip, userAgent(req));
    if (!res.ok) return fail(res.error!, 403, res.code ?? "demo-off");
    if (!res.token || !res.expiresAt) return fail("Demo unavailable.", 500, "server");
    return attachSession(ok({ user: res.user }), res.token, res.expiresAt);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Demo login failed.", 500, "server");
  }
}