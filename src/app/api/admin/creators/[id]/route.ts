import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { adminIdentity, creatorDetail, patchCreator } from "@/server/store/admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["suspend", "restore", "verify", "unverify", "official", "unofficial", "promote", "demote"])
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  const { id } = await params;
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Staff access required.", 403, "forbidden");

    const detail = await creatorDetail(id);
    if (!detail) return fail("Creator not found.", 404, "notfound");
    return ok({ ...detail, role: profile.role });
  } catch (err) {
    return serverError(err, "Could not load that creator.");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  const { profile } = await adminIdentity(viewer?.id ?? null);
  if (!profile) return fail("Staff access required.", 403, "forbidden");
  if (profile.role !== "admin") return fail("Only admins can change account standing.", 403, "forbidden");
  if (profile.id === id) return fail("You cannot change your own standing here.", 400, "self");

  const limit = await rateLimit("profile", `${profile.id}:${clientIp(req)}`);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = patchSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Unknown action.", 400, "validation");

  const map: Record<string, Record<string, unknown>> = {
    suspend: { suspended_at: new Date().toISOString() },
    restore: { suspended_at: null },
    verify: { verified: true },
    unverify: { verified: false },
    official: { is_official: true },
    unofficial: { is_official: false },
    promote: { role: "moderator" },
    demote: { role: "user" }
  };

  try {
    await patchCreator(id, map[parsed.data.action]);
    return ok({ action: parsed.data.action, id });
  } catch (err) {
    return serverError(err, "Could not update that account.");
  }
}