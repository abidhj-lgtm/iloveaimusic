import { NextRequest } from "next/server";
import { signup } from "@/server/auth-service";
import { signupSchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { attachDevBox, clientIp, fail, json, ok, readBody, readDevBox, sameOrigin, serverError } from "@/server/http";
import { newToken } from "@/server/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("signup", ip);
  if (!limit.ok) return fail(`Too many signups from this connection. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = signupSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  const boxId = readDevBox(req) ?? newToken();
  try {
    const res = await signup(parsed.data.name, parsed.data.email, parsed.data.password, ip, boxId);
    return res.ok ? attachDevBox(ok({ user: res.user }), boxId) : json(res, 400);
  } catch (err) {
    return serverError(err, "Signup failed.");
  }
}