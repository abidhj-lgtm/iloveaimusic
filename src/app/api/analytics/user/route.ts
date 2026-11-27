import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { userSeries, userTopTracks } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Analytics need Supabase mode.", 501, "mode");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30) || 30));

  try {
    const repo = getRepo();
    const tracks = await repo.tracksByUser(viewer.id);
    const totals = tracks.reduce(
      (acc, t) => ({
        tracks: acc.tracks + 1,
        plays: acc.plays + (t.plays ?? 0),
        likes: acc.likes + (t.like_count ?? 0),
        comments: acc.comments + (t.comment_count ?? 0)
      }),
      { tracks: 0, plays: 0, likes: 0, comments: 0 }
    );

    const [series, topTracks] = await Promise.all([
      userSeries(viewer.id, days),
      userTopTracks(viewer.id, days, 10)
    ]);

    return ok({ totals, series, topTracks, days });
  } catch (err) {
    return serverError(err, "Could not load your analytics.");
  }
}