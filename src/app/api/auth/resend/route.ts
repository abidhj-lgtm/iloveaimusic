import { NextRequest } from "next/server";
import { resendVerification } from "@/server/auth-service";
import { emailOnlySchema, firstIssue } from "@/server/validation";
import { rateLimit } from "@/server/ratelimit";
import { attachDevBox, clientIp, fail, json, ok, readBody, readDevBox, sameOrigin, serverError } from "@/server/http";
import { newToken } from "@/server/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("resend", ip);
  if (!limit.ok) return fail(`Please wait ${limit.retryAfter}s before requesting another link.`, 429, "rate");

  const parsed = emailOnlySchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  const boxId = readDevBox(req) ?? newToken();
  try {
    const res = await resendVerification(parsed.data.email, ip, boxId);
    return res.ok ? attachDevBox(ok(), boxId) : json(res, 400);
  } catch (err) {
    return serverError(err, "Could not resend.");
  }
}