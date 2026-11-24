import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_ENABLED, OAUTH_STATE_COOKIE, SITE_URL } from "@/server/env";
import { exchangeGoogleCode, loginWithGoogleProfile } from "@/server/auth-service";
import { attachSession, clientIp, userAgent } from "@/server/http";

export const dynamic = "force-dynamic";

function bounce(path: string): NextResponse {
  const res = NextResponse.redirect(`${SITE_URL}${path}`);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_ENABLED) return bounce("/login?error=google-off");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const [stateToken, nextPart] = state.split(".");

  if (!code || !expected || stateToken !== expected) return bounce("/login?error=google-state");

  let next = "/";
  try {
    const decoded = Buffer.from(nextPart ?? "", "base64url").toString("utf8");
    if (decoded.startsWith("/") && !decoded.startsWith("//")) next = decoded;
  } catch { /* keep default */ }

  const profile = await exchangeGoogleCode(code);
  if (!profile) return bounce("/login?error=google-exchange");

  const res = await loginWithGoogleProfile(profile, clientIp(req), userAgent(req));
  if (!res.ok || !res.token || !res.expiresAt) return bounce("/login?error=google-account");

  return attachSession(bounce(next), res.token, res.expiresAt);
}