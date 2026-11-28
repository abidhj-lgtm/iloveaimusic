import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { adminIdentity, patchTrack } from "@/server/store/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["hide", "publish", "delete", "restore"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  const { profile } = await adminIdentity(viewer?.id ?? null);
  if (!profile) return fail("Staff access required.", 403, "forbidden");
  if (profile.role !== "admin") return fail("Only admins can moderate tracks.", 403, "forbidden");

  const limit = await rateLimit("profile", `${profile.id}:${clientIp(req)}`);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Unknown action.", 400, "validation");

  const map: Record<string, Record<string, unknown>> = {
    hide: { visibility: "unlisted" },
    publish: { visibility: "public", status: "published", deleted_at: null },
    delete: { deleted_at: new Date().toISOString() },
    restore: { deleted_at: null, visibility: "public", status: "published" }
  };

  try {
    await patchTrack(id, map[parsed.data.action]);
    return ok({ action: parsed.data.action, id });
  } catch (err) {
    return serverError(err, "Could not update that track.");
  }
}