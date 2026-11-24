import { NextRequest } from "next/server";
import { login } from "@/server/auth-service";
import { loginSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { attachSession, clientIp, fail, json, ok, readBody, sameOrigin, userAgent } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("login", ip);
  if (!limit.ok) return fail(`Too many login attempts. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = loginSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const res = await login(parsed.data.email, parsed.data.password, ip, userAgent(req));
    if (!res.ok || !res.token || !res.expiresAt) return json({ ok: false, error: res.error, code: res.code }, 400);
    return attachSession(ok({ user: res.user }), res.token, res.expiresAt);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Login failed.", 500, "server");
  }
}