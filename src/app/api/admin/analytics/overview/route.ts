import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { fail, ok, serverError, readSessionToken } from "@/server/http";
import { adminIdentity } from "@/server/store/admin";
import { SUPABASE_URL, SUPABASE_KEY } from "@/server/env";

export const dynamic = "force-dynamic";

const rest = () => `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json"
  };
}

export async function GET(req: NextRequest) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Admin access required.", 403, "forbidden");

    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Query daily_stats directly for site-wide aggregation
    const res = await fetch(
      `${rest()}/daily_stats?entity_type=in.(track,profile)&day=gte.${from.toISOString().split("T")[0]}&day=lte.${to.toISOString().split("T")[0]}&select=day,total_views,unique_visitors,plays`,
      { headers: headers(), cache: "no-store" }
    );
    
    if (!res.ok) throw new Error("Failed to fetch daily stats");
    const rows = await res.json();

    const totalViews = rows.reduce((sum: number, r: any) => sum + (r.total_views || 0), 0);
    const totalUnique = rows.reduce((sum: number, r: any) => sum + (r.unique_visitors || 0), 0);
    const totalPlays = rows.reduce((sum: number, r: any) => sum + (r.plays || 0), 0);

    // Group by day for the trend chart
    const trendMap = new Map();
    for (const r of rows) {
      const day = r.day;
      if (!trendMap.has(day)) trendMap.set(day, { date: day, views: 0, unique: 0, plays: 0 });
      const entry = trendMap.get(day);
      entry.views += r.total_views || 0;
      entry.unique += r.unique_visitors || 0;
      entry.plays += r.plays || 0;
    }

    const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return ok({
      summary: {
        totalViews,
        totalUnique,
        totalPlays
      },
      trend
    });
  } catch (err) {
    return serverError(err, "Could not load admin analytics.");
  }
}