import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { fail, ok, serverError, readSessionToken } from "@/server/http";
import { getRepo } from "@/server/store";
import { getStatsRange } from "@/server/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await resolveSession(readSessionToken(req));
    if (!viewer) return fail("Authentication required.", 401, "unauthorized");

    const repo = getRepo();
    const track = await repo.findTrackById(id);
    if (!track) return fail("Track not found.", 404, "notfound");

    // Enforce privacy: only the owner or an admin can view analytics
    const isAdmin = viewer.role === "admin" || viewer.role === "moderator";
    if (track.user_id !== viewer.id && !isAdmin) {
      return fail("You can only view analytics for your own tracks.", 403, "forbidden");
    }

    // Get last 30 days of data
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const stats = await getStatsRange("track", id, from, to, "daily");

    const totalViews = stats.reduce((sum, r) => sum + Number(r.total_views), 0);
    const uniqueVisitors = stats.reduce((sum, r) => sum + Number(r.unique_visitors), 0);
    const plays = track.plays; // Plays are tracked separately in the tracks table

    return ok({
      summary: {
        totalViews,
        uniqueVisitors,
        plays,
        conversionRate: uniqueVisitors > 0 ? (plays / uniqueVisitors).toFixed(2) : "0.00"
      },
      trend: stats.map((s) => ({
        date: new Date(s.period).toISOString().split("T")[0],
        views: Number(s.total_views),
        plays: Number(s.plays)
      }))
    });
  } catch (err) {
    return serverError(err, "Could not load track analytics.");
  }
}