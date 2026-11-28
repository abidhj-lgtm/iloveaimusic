import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { fail, ok, serverError, readSessionToken } from "@/server/http";
import { getRepo } from "@/server/store";
import { getStatsRange } from "@/server/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    if (!viewer) return fail("Authentication required.", 401, "unauthorized");

    const repo = getRepo();
    const profile = await repo.findProfileById(viewer.id);
    if (!profile) return fail("Profile not found.", 404, "notfound");

    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Get profile views
    const profileStats = await getStatsRange("profile", viewer.id, from, to, "daily");
    const profileViews = profileStats.reduce((sum, r) => sum + Number(r.total_views), 0);
    const profileUnique = profileStats.reduce((sum, r) => sum + Number(r.unique_visitors), 0);

    // 2. Get all track views for this creator
    const tracks = await repo.tracksByUser(viewer.id);
    let totalTrackViews = 0;
    let totalTrackUnique = 0;
    const topTracks = [];

    for (const t of tracks.slice(0, 10)) { // Top 10 tracks
      const tId = t.legacy_id ?? t.id;
      const tStats = await getStatsRange("track", tId, from, to, "daily");
      const tViews = tStats.reduce((sum, r) => sum + Number(r.total_views), 0);
      const tUnique = tStats.reduce((sum, r) => sum + Number(r.unique_visitors), 0);
      
      totalTrackViews += tViews;
      totalTrackUnique += tUnique;

      topTracks.push({
        id: tId,
        title: t.title,
        views: tViews,
        plays: t.plays,
        conversionRate: tUnique > 0 ? ((t.plays / tUnique) * 100).toFixed(1) + "%" : "0%"
      });
    }

    // Sort top tracks by views
    topTracks.sort((a, b) => b.views - a.views);

    // 3. Aggregate daily trend (profile + all tracks)
    // For simplicity, we'll just return the profile trend + total summary
    const trend = profileStats.map((s) => ({
      date: new Date(s.period).toISOString().split("T")[0],
      views: Number(s.total_views),
      unique: Number(s.unique_visitors)
    }));

    return ok({
      summary: {
        profileViews,
        profileUnique,
        totalTrackViews,
        totalTrackUnique,
        totalTracks: tracks.length
      },
      topTracks,
      trend
    });
  } catch (err) {
    return serverError(err, "Could not load creator analytics.");
  }
}