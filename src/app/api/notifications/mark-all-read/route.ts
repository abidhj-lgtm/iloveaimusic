import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { markAllRead, unreadCount } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Notifications need Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  try {
    await markAllRead(viewer.id);
    return ok({ unread: await unreadCount(viewer.id) });
  } catch (err) {
    return serverError(err, "Could not mark notifications read.");
  }
}