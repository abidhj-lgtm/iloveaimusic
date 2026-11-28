import { NextRequest } from "next/server";
import { z } from "zod";
import { getRepo, resolveTrackId, toClientComment } from "@/server/store";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { notify } from "@/server/store/features";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    text: z.string().trim().min(1).max(1000).optional(),
    body: z.string().trim().min(1).max(1000).optional()
  })
  .refine((v) => !!(v.text || v.body), "Write something first.");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to join the conversation.", 401, "unauthorized");

  const limit = await rateLimit("comment", viewer.id);
  if (!limit.ok) return fail(`Comment limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = schema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Write something first.", 400, "validation");
  const text = (parsed.data.text ?? parsed.data.body)!.trim();

  try {
    const repo = getRepo();

    // The URL carries a public/legacy id — resolve it to the real row.
    let resolved: string | null = null;
    try { resolved = await resolveTrackId(id); } catch { resolved = null; }

    const track = await repo.findTrackById(resolved ?? id);
    if (!track || track.deleted_at) return fail("Track not found.", 404, "notfound");
    const realTrackId = track.id;

    const inserted = await repo.addComment(realTrackId, viewer.id, text);

    // addComment may return the row or nothing — recover the row either way.
    let row: any = inserted && (inserted as any).id ? inserted : null;
    if (!row) {
      const rows = await repo.commentsForTracks([realTrackId]);
      row = [...rows].reverse().find((c) => c.user_id === viewer.id) ?? null;
    }
    if (!row) return fail("That comment did not save. Try again.", 500, "persist");

    const comment = toClientComment(
      row,
      viewer.legacy_id ?? viewer.id,
      track.legacy_id ?? track.id
    );

    // Side effects must never break the comment itself.
    if (track.user_id !== viewer.id) {
      try {
        await notify({
          userId: track.user_id,
          kind: "comment",
          actorId: viewer.id,
          trackId: realTrackId,
          commentId: row.id
        });
      } catch { /* notification is best-effort */ }
    }

    try {
      await repo.audit(viewer.id, "comment.create", row.id, { track: realTrackId }, clientIp(req));
    } catch { /* audit is best-effort */ }

    return ok({ comment });
  } catch (err) {
    return serverError(err, "Could not post the comment.");
  }
}