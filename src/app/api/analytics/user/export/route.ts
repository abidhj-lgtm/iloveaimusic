import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, readSessionToken, serverError } from "@/server/http";
import { getRepo } from "@/server/store";
import { userTopTracks } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return new Response("Needs Supabase mode.", { status: 501 });
  
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return new Response("Log in first.", { status: 401 });

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30) || 30));

  try {
    const repo = getRepo();
    const tracks = await repo.tracksByUser(viewer.id);
    
    // Fetch top tracks for the period
    const topTracks = await userTopTracks(viewer.id, days, 100);
    
    // Build CSV content
    const headers = ["Track Title", "Total Plays", "Unique Listeners", "Likes", "Comments", "Created At"];
    const rows = tracks.map((t) => {
      const stats = topTracks.find((tt) => tt.track_id === t.id);
      return [
        `"${t.title.replace(/"/g, '""')}"`,
        stats?.plays ?? t.plays,
        stats?.unique_listeners ?? 0,
        t.like_count ?? 0,
        t.comment_count ?? 0,
        new Date(t.created_at).toISOString().split("T")[0]
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="analytics_export_${days}days.csv"`
      }
    });
  } catch (err) {
    return serverError(err, "Could not generate export.");
  }
}