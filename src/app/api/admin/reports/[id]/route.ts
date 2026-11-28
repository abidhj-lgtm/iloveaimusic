import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { fail, ok, serverError, readBody, readSessionToken } from "@/server/http";
import { adminIdentity } from "@/server/store/admin";
import {
  getReport,
  updateReportStatus,
  hideTrack,
  deleteTrack,
  hideComment,
  deleteComment,
  suspendUser,
  unsuspendUser,
  type ReportStatus
} from "@/server/store/moderation";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum([
    "dismiss",
    "investigate",
    "resolve",
    "hide_track",
    "delete_track",
    "hide_comment",
    "delete_comment",
    "suspend_user",
    "unsuspend_user"
  ]),
  notes: z.string().optional()
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Admin access required.", 403, "forbidden");

    const report = await getReport(params.id);
    if (!report) return fail("Report not found.", 404, "notfound");

    return ok({ report });
  } catch (err) {
    return serverError(err, "Could not load report.");
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Admin access required.", 403, "forbidden");
    if (profile.role !== "admin") return fail("Only admins can moderate reports.", 403, "forbidden");

    const body = await readBody(req);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid action.", 400, "validation");

    const report = await getReport(params.id);
    if (!report) return fail("Report not found.", 404, "notfound");

    const { action, notes } = parsed.data;
    const moderatorId = profile.id;

    // Handle status updates
    if (action === "dismiss") {
      await updateReportStatus(params.id, "dismissed", moderatorId, notes);
      return ok({ action: "dismissed" });
    }
    if (action === "investigate") {
      await updateReportStatus(params.id, "investigating", moderatorId);
      return ok({ action: "investigating" });
    }
    if (action === "resolve") {
      await updateReportStatus(params.id, "resolved", moderatorId, notes);
      return ok({ action: "resolved" });
    }

    // Handle content actions
    if (action === "hide_track" && report.track_id) {
      await hideTrack(report.track_id, moderatorId);
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "Track hidden");
      return ok({ action: "track_hidden" });
    }
    if (action === "delete_track" && report.track_id) {
      await deleteTrack(report.track_id, moderatorId);
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "Track deleted");
      return ok({ action: "track_deleted" });
    }
    if (action === "hide_comment" && report.comment_id) {
      await hideComment(report.comment_id, moderatorId);
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "Comment hidden");
      return ok({ action: "comment_hidden" });
    }
    if (action === "delete_comment" && report.comment_id) {
      await deleteComment(report.comment_id, moderatorId);
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "Comment deleted");
      return ok({ action: "comment_deleted" });
    }

    // Handle user actions
    if (action === "suspend_user") {
      const targetUserId = report.track?.user_id ?? report.comment?.user_id;
      if (!targetUserId) return fail("No user to suspend.", 400, "validation");
      await suspendUser(targetUserId, moderatorId, notes ?? "Suspended for policy violation");
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "User suspended");
      return ok({ action: "user_suspended" });
    }
    if (action === "unsuspend_user") {
      const targetUserId = report.track?.user_id ?? report.comment?.user_id;
      if (!targetUserId) return fail("No user to unsuspend.", 400, "validation");
      await unsuspendUser(targetUserId);
      await updateReportStatus(params.id, "resolved", moderatorId, notes ?? "User unsuspended");
      return ok({ action: "user_unsuspended" });
    }

    return fail("Unknown action.", 400, "validation");
  } catch (err) {
    return serverError(err, "Could not process action.");
  }
}