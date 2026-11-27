import { NextRequest } from "next/server";
import { getRepo, resolveTrackId } from "@/server/store";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { trackSeries } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL) return fail("Analytics need Supabase mode.", 501, "mode");
  const { id } = await params;

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30) || 30));

  try {
    const repo = getRepo();
    const realId = await resolveTrackId(id);
    const track = realId ? await repo.findTrackById(realId) : null;
    if (!track || track.deleted_at) return fail("Track not found.", 404, "notfound");
    if (track.user_id !== viewer.id) return fail("Only the creator can see track analytics.", 403, "forbidden");

    const series = await trackSeries(realId!, days);
    return ok({
      track: {
        id: track.id,
        title: track.title,
        plays: track.plays,
        likeCount: track.like_count,
        commentCount: track.comment_count
      },
      series,
      days
    });
  } catch (err) {
    return serverError(err, "Could not load track analytics.");
  }
}