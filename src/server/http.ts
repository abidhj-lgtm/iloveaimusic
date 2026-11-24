import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, DEVBOX_COOKIE, DEVBOX_TTL_MS, MAIL_MODE } from "./env";
import { newRequestId, reportError, log } from "./observability";

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export const userAgent = (req: NextRequest) => req.headers.get("user-agent") ?? "unknown";

function stamp(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

export function json(data: unknown, status = 200, requestId = newRequestId()): NextResponse {
  return stamp(NextResponse.json(data, { status }), requestId);
}

export const ok = (extra: Record<string, unknown> = {}) => json({ ok: true, ...extra });

export const fail = (error: string, status = 400, code?: string) => {
  const requestId = newRequestId();
  log(status >= 500 ? "error" : "warn", error, { requestId, status, code });
  return json({ ok: false, error, code, requestId }, status, requestId);
};

export function serverError(err: unknown, fallback: string): NextResponse {
  const requestId = newRequestId();
  const msg = err instanceof Error ? err.message : fallback;
  reportError(err, { requestId });
  const isConfig = /Production requires|Cannot reach Supabase/.test(msg);
  return json({ ok: false, error: msg, code: isConfig ? "config" : "server", requestId }, isConfig ? 503 : 500, requestId);
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === req.nextUrl.host; } catch { return false; }
}

export const readSessionToken = (req: NextRequest) => req.cookies.get(SESSION_COOKIE)?.value ?? null;
export const readDevBox = (req: NextRequest) => req.cookies.get(DEVBOX_COOKIE)?.value ?? null;

export function attachSession(res: NextResponse, token: string, expiresAt: number): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(expiresAt)
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export function attachDevBox(res: NextResponse, boxId: string): NextResponse {
  if (MAIL_MODE !== "dev") return res;
  res.cookies.set(DEVBOX_COOKIE, boxId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(Date.now() + DEVBOX_TTL_MS)
  });
  return res;
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const raw = await req.json();
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch { return {}; }
}