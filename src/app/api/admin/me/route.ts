import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { adminIdentity } from "@/server/store/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile, role } = await adminIdentity(viewer?.id ?? null);
    return ok({
      isAdmin: !!profile,
      role: profile?.role ?? role ?? "user",
      canDestroy: profile?.role === "admin",
      me: profile
    });
  } catch (err) {
    return serverError(err, "Could not verify admin access.");
  }
}