import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { getRepo } from "@/server/store";
import { cleanupOldNotifications } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const repo = getRepo();
  const profile = await repo.findProfileById(viewer.id);
  if ((profile as any)?.role !== "admin") return fail("Admins only.", 403, "forbidden");

  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30) || 30;
    const deleted = await cleanupOldNotifications(days);
    return ok({ deleted });
  } catch (err) {
    return serverError(err, "Could not clean up notifications.");
  }
}