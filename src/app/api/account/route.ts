import { NextRequest, NextResponse } from "next/server";
import { exportAccount, deleteAccount } from "@/server/account-service";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clearSession, clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to export your data.", 401, "unauthorized");
  try {
    const data = await exportAccount(viewer.id);
    if (!data) return fail("Account not found.", 404, "notfound");
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ilistenai-${viewer.handle}-export.json"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    return serverError(err, "Export failed.");
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = await rateLimit("profile", viewer.id);
  if (!limit.ok) return fail(`Please wait ${limit.retryAfter}s.`, 429, "rate");

  const body = await readBody(req);
  if (String(body.confirm ?? "") !== viewer.handle) {
    return fail(`Type your handle “${viewer.handle}” to confirm.`, 400, "confirm");
  }

  try {
    const res = await deleteAccount(viewer.id, clientIp(req));
    if (!res.ok) return fail(res.error!, 400, "delete");
    return clearSession(ok({ removedTracks: res.removedTracks, purgeAfter: res.purgeAfter }));
  } catch (err) {
    return serverError(err, "Account deletion failed.");
  }
}