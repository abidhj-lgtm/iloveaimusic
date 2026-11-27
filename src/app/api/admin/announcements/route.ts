import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { getRepo } from "@/server/store";
import { broadcastAnnouncement } from "@/server/store/features";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  link: z.string().url().optional().nullable(),
  expiresHours: z.number().int().min(1).max(720).optional()
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Announcements need Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const repo = getRepo();
  const profile = await repo.findProfileById(viewer.id);
  if ((profile as any)?.role !== "admin") return fail("Admins only.", 403, "forbidden");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid announcement.", 400, "validation");

  try {
    const d = parsed.data;
    const expiresAt = d.expiresHours
      ? new Date(Date.now() + d.expiresHours * 60 * 60 * 1000).toISOString()
      : null;

    const count = await broadcastAnnouncement({
      title: d.title,
      body: d.body,
      link: d.link ?? null,
      created_by: viewer.id,
      expires_at: expiresAt
    });

    return ok({ sent: count });
  } catch (err) {
    return serverError(err, "Could not broadcast announcement.");
  }
}