import { NextRequest } from "next/server";
import { logout } from "@/server/auth-service";
import { clearSession, clientIp, fail, ok, readSessionToken, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  try {
    await logout(readSessionToken(req), clientIp(req));
    return clearSession(ok());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Logout failed.", 500, "server");
  }
}