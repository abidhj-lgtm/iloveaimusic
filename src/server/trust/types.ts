import "server-only";
import type { LicenseId, AiToolId } from "@/lib/rights-options";

export type ReportReason = "copyright" | "spam" | "hate" | "explicit_mislabel" | "broken_media" | "impersonation" | "other";
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";
export type ModAction = "hide" | "remove" | "restore" | "dismiss" | "review" | "strike" | "undo";

export interface ReportRow {
  id: string;
  track_id: string | null;
  comment_id: string | null;
  reporter_id: string | null;
  target_owner: string | null;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution_note: string;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RightsRow {
  track_id: string;
  attested: boolean;
  license: LicenseId | string;
  ai_tool: AiToolId | string;
  human_contribution: string;
  explicit: boolean;
  third_party_samples: boolean;
  monetizable: boolean;
  distribution_ok: boolean;
  updated_at: string;
}

export interface StrikeRow {
  id: string; user_id: string; reason: string; weight: number;
  issued_by: string | null; report_id: string | null;
  created_at: string; revoked_at: string | null;
}

export interface ModRow {
  id: string; batch_id: string; actor_id: string | null; action: string;
  target_type: "track" | "comment" | "report" | "profile"; target_id: string;
  before_state: Record<string, unknown>; note: string;
  created_at: string; undone_at: string | null;
}

export interface TrustShape {
  reports: ReportRow[]; rights: RightsRow[]; strikes: StrikeRow[];
  actions: ModRow[]; roles: { user_id: string; role: "user" | "creator" | "moderator" | "admin" }[];
}

export const REASON_LABEL: Record<ReportReason, string> = {
  copyright: "Copyright", spam: "Spam", hate: "Hate / harassment",
  explicit_mislabel: "Explicit mislabel", broken_media: "Broken audio",
  impersonation: "Impersonation", other: "Other"
};

export const defaultRights = (trackId: string): RightsRow => ({
  track_id: trackId, attested: false, license: "all_rights_reserved",
  ai_tool: "unspecified", human_contribution: "", explicit: false,
  third_party_samples: false, monetizable: false, distribution_ok: true,
  updated_at: new Date().toISOString()
});