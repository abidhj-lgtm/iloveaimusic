import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_ENABLED, OAUTH_STATE_COOKIE } from "@/server/env";
import { googleAuthUrl, newOAuthState } from "@/server/auth-service";
import { clientIp, fail } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!GOOGLE_ENABLED) return fail("Google sign-in is not configured on this deployment.", 503, "google-off");
  const limit = await rateLimit("login", clientIp(req));
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const next = req.nextUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const state = newOAuthState();
  const res = NextResponse.redirect(googleAuthUrl(state, safeNext));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 600
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}