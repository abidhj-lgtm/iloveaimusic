import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { adminIdentity, platformOverview, recentActivity } from "@/server/store/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Staff access required.", 403, "forbidden");

    const [overview, activity] = await Promise.all([platformOverview(), recentActivity(14)]);
    return ok({ overview, activity, role: profile.role });
  } catch (err) {
    return serverError(err, "Could not load the platform overview.");
  }
}