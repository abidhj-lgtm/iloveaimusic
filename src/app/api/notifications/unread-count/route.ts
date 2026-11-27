import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { unreadCount } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Notifications need Supabase mode.", 501, "mode");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return ok({ unread: 0 });

  try {
    return ok({ unread: await unreadCount(viewer.id) });
  } catch (err) {
    return serverError(err, "Could not count notifications.");
  }
}