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
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${rest()}/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
    cache: "no-store"
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

interface Insight {
  kind: "success" | "warning" | "info" | "danger";
  title: string;
  detail: string;
  metric?: string;
}

function generateInsights(comparison: any[], referrers: any[], countries: any[], topGrowing: any[]): Insight[] {
  const insights: Insight[] = [];
  const map = new Map(comparison.map((r: any) => [r.metric, r]));
  
  const views = map.get("total_views");
  const unique = map.get("unique_visitors");
  const newVis = map.get("new_visitors");
  
  // Growth insights
  if (views && Math.abs(Number(views.change_pct)) >= 20) {
    const up = Number(views.change_pct) > 0;
    insights.push({
      kind: up ? "success" : "danger",
      title: up ? "Traffic is surging" : "Traffic is declining",
      detail: `Total views ${up ? "grew" : "dropped"} ${Math.abs(Number(views.change_pct))}% vs the previous period (${Number(views.current_value).toLocaleString()} vs ${Number(views.previous_value).toLocaleString()}).`,
      metric: "total_views"
    });
  }
  
  if (newVis && Number(newVis.change_pct) <= -15) {
    insights.push({
      kind: "warning",
      title: "New visitors are falling",
      detail: `New visitor count dropped ${Math.abs(Number(newVis.change_pct))}%. Check acquisition channels and landing pages.`,
      metric: "new_visitors"
    });
  }
  
  // Top referrer insight
  if (referrers.length > 0 && referrers[0].views > 50) {
    const top = referrers[0];
    insights.push({
      kind: "info",
      title: `Top traffic source: ${top.source}`,
      detail: `${Number(top.views).toLocaleString()} views from ${top.source} (${Number(top.unique_visitors).toLocaleString()} unique). Consider doubling down here.`,
      metric: "referrer"
    });
  }
  
  // Top country insight
  if (countries.length > 0 && countries[0].views > 100) {
    const top = countries[0];
    insights.push({
      kind: "info",
      title: `Biggest audience: ${top.country}`,
      detail: `${Number(top.views).toLocaleString()} views from ${top.country}. Consider localized marketing.`,
      metric: "country"
    });
  }
  
  // Top growing track
  if (topGrowing.length > 0 && Number(topGrowing[0].growth_pct) >= 50) {
    const t = topGrowing[0];
    insights.push({
      kind: "success",
      title: `Breakout track: "${t.title}"`,
      detail: `By ${t.artist_name} — up ${Number(t.growth_pct)}% (${Number(t.current_views).toLocaleString()} views this period). Consider featuring it.`,
      metric: "growing_track"
    });
  }
  
  // Low traffic warning
  if (views && Number(views.current_value) < 100 && Number(views.previous_value) < 100) {
    insights.push({
      kind: "warning",
      title: "Platform is still quiet",
      detail: `Only ${Number(views.current_value).toLocaleString()} views this period. Focus on creator acquisition and content promotion.`,
      metric: "total_views"
    });
  }
  
  return insights.slice(0, 5); // Cap at 5 insights
}

export async function GET(req: NextRequest) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Admin access required.", 403, "forbidden");

    // Parse date range from query (default: last 30 days)
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [trend, comparison, referrers, countries, topGrowing] = await Promise.all([
      // Site-wide daily trend
      (async () => {
        const res = await fetch(
          `${rest()}/daily_stats?day=gte.${from.toISOString().split("T")[0]}&day=lte.${to.toISOString().split("T")[0]}&select=day,total_views,unique_visitors,plays`,
          { headers: headers(), cache: "no-store" }
        );
        if (!res.ok) return [];
        const rows = await res.json();
        const trendMap = new Map<string, any>();
        for (const r of rows) {
          if (!trendMap.has(r.day)) trendMap.set(r.day, { date: r.day, views: 0, unique: 0, plays: 0 });
          const e = trendMap.get(r.day);
          e.views += r.total_views || 0;
          e.unique += r.unique_visitors || 0;
          e.plays += r.plays || 0;
        }
        return Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      })(),
      
      // Period comparison
      rpc("get_period_comparison", { p_from: from.toISOString(), p_to: to.toISOString() }),
      
      // Referrer breakdown
      rpc("get_referrer_breakdown", { p_from: from.toISOString(), p_to: to.toISOString() }),
      
      // Country breakdown
      rpc("get_country_breakdown", { p_from: from.toISOString(), p_to: to.toISOString() }),
      
      // Top growing tracks
      rpc("get_top_growing_tracks", { p_from: from.toISOString(), p_to: to.toISOString() })
    ]);

    // Generate automated insights
    const insights = generateInsights(
      comparison ?? [],
      referrers ?? [],
      countries ?? [],
      topGrowing ?? []
    );

    // Build summary from comparison
    const summary: any = {};
    for (const r of comparison ?? []) {
      summary[r.metric] = {
        current: Number(r.current_value),
        previous: Number(r.previous_value),
        changePct: Number(r.change_pct)
      };
    }

    return ok({
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      summary,
      trend: trend ?? [],
      referrers: referrers ?? [],
      countries: countries ?? [],
      topGrowing: topGrowing ?? [],
      insights
    });
  } catch (err) {
    return serverError(err, "Could not load admin analytics.");
  }
}