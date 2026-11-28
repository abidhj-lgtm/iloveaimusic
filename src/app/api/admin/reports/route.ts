import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { fail, ok, serverError, readSessionToken } from "@/server/http";
import { adminIdentity } from "@/server/store/admin";
import { listReports, type ReportStatus } from "@/server/store/moderation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Admin access required.", 403, "forbidden");

    const status = req.nextUrl.searchParams.get("status") as ReportStatus | null;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

    const reports = await listReports({
      status: status && ["open", "investigating", "resolved", "dismissed"].includes(status) ? status : undefined,
      limit,
      offset
    });

    return ok({ reports });
  } catch (err) {
    return serverError(err, "Could not load reports.");
  }
}