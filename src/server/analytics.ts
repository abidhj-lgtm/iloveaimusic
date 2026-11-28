import "server-only";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";
import { reportError } from "./observability";

const rest = () => `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
const eq = (v: string) => `eq.${v}`;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=minimal",
    ...extra
  };
}

/** Call a PostgreSQL RPC function via Supabase REST. */
async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${rest()}/rpc/${fn}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(args),
      cache: "no-store"
    });
    if (!res.ok) {
      const text = await res.text();
      reportError(new Error(`analytics rpc ${fn} (${res.status}): ${text}`), { route: `analytics:${fn}` });
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text) as T; } catch { return null; }
  } catch (err) {
    reportError(err, { route: `analytics:${fn}` });
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   REQUEST METADATA EXTRACTION
   ══════════════════════════════════════════════════════════════ */

interface VisitorInfo {
  ip: string;
  ua: string;
  referer: string | null;
  landingPath: string;
  country: string;
}

/** Extract IP from request, handling proxies (Vercel, Cloudflare, etc.) */
function extractIp(req: Request): string {
  const h = (name: string) => req.headers.get(name);
  return (
    h("x-forwarded-for")?.split(",")[0]?.trim() ??
    h("x-real-ip") ??
    h("cf-connecting-ip") ??
    h("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Detect country from provider headers (free, instant, no rate limit). */
function extractCountry(req: Request): string {
  const h = (name: string) => req.headers.get(name);
  // Vercel provides this automatically
  const vercel = h("x-vercel-ip-country");
  if (vercel) return vercel.toUpperCase();
  // Cloudflare provides this
  const cf = h("cf-ipcountry");
  if (cf && cf !== "XX" && cf !== "T1") return cf.toUpperCase();
  return "unknown";
}

/** Gather all visitor metadata from the request. */
export function getVisitorInfo(req: Request, path: string): VisitorInfo {
  return {
    ip: extractIp(req),
    ua: req.headers.get("user-agent") ?? "",
    referer: req.headers.get("referer"),
    landingPath: path,
    country: extractCountry(req)
  };
}

/* ══════════════════════════════════════════════════════════════
   TRACKING FUNCTIONS
   ══════════════════════════════════════════════════════════════ */

/**
 * Record a track view. Fire-and-forget — never throws.
 *
 * Call from your track detail page server component:
 *   void recordTrackView(trackId, req, viewerId);
 *
 * The SQL function handles:
 *   - Bot filtering (empty/suspicious user agents)
 *   - Self-view exclusion (creator viewing own track)
 *   - New visitor detection
 *   - Domain extraction from referer
 *   - Device type classification
 */
export async function recordTrackView(
  trackId: string,
  req: Request,
  viewerId?: string | null
): Promise<void> {
  try {
    const info = getVisitorInfo(req, `/track/${trackId}`);
    await rpc("record_track_view", {
      p_track_id: trackId,
      p_viewer_id: viewerId ?? null,
      p_ip: info.ip,
      p_ua: info.ua,
      p_referer: info.referer,
      p_landing_path: info.landingPath,
      p_country: info.country
    });
  } catch (err) {
    // Analytics must never break the page
    reportError(err, { route: "analytics:recordTrackView", trackId });
  }
}

/**
 * Record a profile view. Fire-and-forget — never throws.
 *
 * Call from your profile page server component:
 *   void recordProfileView(profileId, req, viewerId);
 */
export async function recordProfileView(
  profileId: string,
  req: Request,
  viewerId?: string | null
): Promise<void> {
  try {
    const info = getVisitorInfo(req, `/profile/${profileId}`);
    await rpc("record_profile_view", {
      p_profile_id: profileId,
      p_viewer_id: viewerId ?? null,
      p_ip: info.ip,
      p_ua: info.ua,
      p_referer: info.referer,
      p_landing_path: info.landingPath,
      p_country: info.country
    });
  } catch (err) {
    reportError(err, { route: "analytics:recordProfileView", profileId });
  }
}

/* ══════════════════════════════════════════════════════════════
   QUERY HELPERS (for Phase 3 dashboards)
   ══════════════════════════════════════════════════════════════ */

export interface StatsRow {
  period: string;
  total_views: number;
  unique_visitors: number;
  new_visitors: number;
  plays: number;
  signups: number;
}

/**
 * Get stats for any custom date range.
 * Automatically picks hourly/daily/monthly granularity based on range size.
 */
export async function getStatsRange(
  entityType: "track" | "profile" | "site",
  entityId: string,
  from: Date,
  to: Date,
  granularity: "auto" | "hourly" | "daily" | "monthly" = "auto"
): Promise<StatsRow[]> {
  const rows = await rpc<StatsRow[]>("get_stats_range", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_granularity: granularity
  });
  return rows ?? [];
}

/** Get total views for a track/profile in the last N days. */
export async function getViewCount(
  entityType: "track" | "profile",
  entityId: string,
  days: number = 30
): Promise<{ total: number; unique: number }> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await getStatsRange(entityType, entityId, from, to, "daily");
  return {
    total: rows.reduce((sum, r) => sum + Number(r.total_views), 0),
    unique: rows.reduce((sum, r) => sum + Number(r.unique_visitors), 0)
  };
}