import "server-only";
import { SUPABASE_URL, SUPABASE_KEY } from "../env";
import { reportError } from "../observability";

const rest = () => `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
const H = (extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  ...extra
});
const eq = (v: string) => `eq.${v}`;

async function req(
  table: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  params: URLSearchParams,
  body?: unknown
): Promise<any[]> {
  const res = await fetch(`${rest()}/${table}?${params}`, {
    method,
    headers: H(method !== "GET" ? { Prefer: "return=representation" } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j?.message ?? j?.hint ?? text; } catch { /* raw */ }
    const err = new Error(`moderation ${table} ${method} (${res.status}): ${detail}`);
    reportError(err, { route: `moderation:${table}`, status: res.status });
    throw err;
  }
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export interface Report {
  id: string;
  reporter_id: string;
  track_id: string | null;
  comment_id: string | null;
  reason: string;
  details: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ReportWithContent extends Report {
  track?: any;
  comment?: any;
  reporter?: any;
  assigned?: any;
}

export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";

export async function listReports(opts: {
  status?: ReportStatus;
  limit?: number;
  offset?: number;
}): Promise<Report[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  if (opts.status) params.set("status", eq(opts.status));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  return await req("reports", "GET", params);
}

export async function getReport(id: string): Promise<ReportWithContent | null> {
  const params = new URLSearchParams();
  params.set("select", "*,track:tracks(*),comment:comments(*),reporter:profiles!reports_reporter_id_fkey(*),assigned:profiles!reports_assigned_to_fkey(*)");
  params.set("id", eq(id));
  params.set("limit", "1");
  const rows = await req("reports", "GET", params);
  return rows[0] ?? null;
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  moderatorId: string,
  notes?: string
): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(id));
  const body: any = {
    status,
    assigned_to: moderatorId,
    resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null
  };
  if (notes) body.resolution_notes = notes;
  await req("reports", "PATCH", params, body);
}

export async function hideTrack(trackId: string, moderatorId: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(trackId));
  await req("tracks", "PATCH", params, {
    visibility: "hidden",
    hidden_by: moderatorId,
    hidden_at: new Date().toISOString()
  });
}

export async function deleteTrack(trackId: string, moderatorId: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(trackId));
  await req("tracks", "PATCH", params, {
    deleted_at: new Date().toISOString(),
    deleted_by: moderatorId
  });
}

export async function hideComment(commentId: string, moderatorId: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(commentId));
  await req("comments", "PATCH", params, {
    hidden: true,
    hidden_by: moderatorId,
    hidden_at: new Date().toISOString()
  });
}

export async function deleteComment(commentId: string, moderatorId: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(commentId));
  await req("comments", "DELETE", params);
}

export async function suspendUser(userId: string, moderatorId: string, reason: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(userId));
  await req("profiles", "PATCH", params, {
    suspended: true,
    suspended_by: moderatorId,
    suspended_at: new Date().toISOString(),
    suspension_reason: reason
  });
}

export async function unsuspendUser(userId: string): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(userId));
  await req("profiles", "PATCH", params, {
    suspended: false,
    suspended_by: null,
    suspended_at: null,
    suspension_reason: null
  });
}