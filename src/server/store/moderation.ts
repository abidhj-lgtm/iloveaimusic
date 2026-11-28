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
  // Fetch the report itself
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("id", eq(id));
  params.set("limit", "1");
  const rows = await req("reports", "GET", params);
  const report = rows[0];
  if (!report) return null;

  const result: ReportWithContent = { ...report };

  // Fetch related track if track_id exists
  if (report.track_id) {
    try {
      const trackParams = new URLSearchParams();
      trackParams.set("select", "id,title,user_id,cover_seed,cover_palette,source");
      trackParams.set("id", eq(report.track_id));
      trackParams.set("limit", "1");
      const trackRows = await req("tracks", "GET", trackParams);
      if (trackRows[0]) {
        result.track = trackRows[0];
        // Fetch artist name
        if (trackRows[0].user_id) {
          const artistParams = new URLSearchParams();
          artistParams.set("select", "name,handle");
          artistParams.set("id", eq(trackRows[0].user_id));
          artistParams.set("limit", "1");
          const artistRows = await req("profiles", "GET", artistParams);
          if (artistRows[0]) {
            result.track.artist_name = artistRows[0].name;
            result.track.artist_handle = artistRows[0].handle;
          }
        }
      }
    } catch { /* track fetch failed, continue without it */ }
  }

  // Fetch related comment if comment_id exists
  if (report.comment_id) {
    try {
      const commentParams = new URLSearchParams();
      commentParams.set("select", "id,text,user_id");
      commentParams.set("id", eq(report.comment_id));
      commentParams.set("limit", "1");
      const commentRows = await req("comments", "GET", commentParams);
      if (commentRows[0]) {
        result.comment = commentRows[0];
        // Fetch commenter name
        if (commentRows[0].user_id) {
          const commenterParams = new URLSearchParams();
          commenterParams.set("select", "name");
          commenterParams.set("id", eq(commentRows[0].user_id));
          commenterParams.set("limit", "1");
          const commenterRows = await req("profiles", "GET", commenterParams);
          if (commenterRows[0]) {
            result.comment.user_name = commenterRows[0].name;
          }
        }
      }
    } catch { /* comment fetch failed, continue without it */ }
  }

  // Fetch reporter if reporter_id exists
  if (report.reporter_id) {
    try {
      const reporterParams = new URLSearchParams();
      reporterParams.set("select", "name,handle");
      reporterParams.set("id", eq(report.reporter_id));
      reporterParams.set("limit", "1");
      const reporterRows = await req("profiles", "GET", reporterParams);
      if (reporterRows[0]) {
        result.reporter = reporterRows[0];
      }
    } catch { /* reporter fetch failed, continue without it */ }
  }

  return result;
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  moderatorId: string,
  notes?: string
): Promise<void> {
  const params = new URLSearchParams();
  params.set("id", eq(id));

  // Build body with only columns that exist (resilient to schema differences)
  const body: any = { status };

  // Try to set optional columns; if they don't exist, the PATCH will fail
  // and we fall back to status-only update
  const fullBody = {
    ...body,
    assigned_to: moderatorId,
    resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
    ...(notes ? { resolution_notes: notes } : {})
  };

  try {
    await req("reports", "PATCH", params, fullBody);
  } catch (err) {
    // If the error is about missing columns, retry with just status
    const msg = String(err);
    if (msg.includes("Could not find") && msg.includes("column")) {
      await req("reports", "PATCH", params, body);
    } else {
      throw err;
    }
  }
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