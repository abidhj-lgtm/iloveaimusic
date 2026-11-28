import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { adminIdentity, bulkPatchTracks, listTracks, type SourceFilter, type TrackFilter, type TrackSort } from "@/server/store/admin";

export const dynamic = "force-dynamic";

const FILTERS = new Set(["all", "live", "hidden", "deleted"]);
const SOURCES = new Set(["all", "upload", "youtube", "synth"]);
const SORTS = new Set(["newest", "oldest", "plays", "likes", "comments", "title"]);

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Staff access required.", 403, "forbidden");

    const p = req.nextUrl.searchParams;
    const page = await listTracks({
      search: (p.get("q") ?? "").slice(0, 120),
      filter: FILTERS.has(p.get("filter") ?? "") ? (p.get("filter") as TrackFilter) : "all",
      source: SOURCES.has(p.get("source") ?? "") ? (p.get("source") as SourceFilter) : "all",
      sort: SORTS.has(p.get("sort") ?? "") ? (p.get("sort") as TrackSort) : "newest",
      userId: p.get("userId") ?? undefined,
      page: Number(p.get("page") ?? 1) || 1,
      perPage: Number(p.get("perPage") ?? 25) || 25
    });

    return ok({ ...page, role: profile.role });
  } catch (err) {
    return serverError(err, "Could not load tracks.");
  }
}

const bulkSchema = z.object({
  ids: z.array(z.string().min(1).max(80)).min(1).max(200),
  action: z.enum(["hide", "publish", "delete", "restore"])
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  const { profile } = await adminIdentity(viewer?.id ?? null);
  if (!profile) return fail("Staff access required.", 403, "forbidden");
  if (profile.role !== "admin") return fail("Only admins can bulk-moderate tracks.", 403, "forbidden");

  const limit = await rateLimit("profile", `${profile.id}:${clientIp(req)}`);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = bulkSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Invalid bulk request.", 400, "validation");

  const map: Record<string, Record<string, unknown>> = {
    hide: { visibility: "unlisted" },
    publish: { visibility: "public", status: "published", deleted_at: null },
    delete: { deleted_at: new Date().toISOString() },
    restore: { deleted_at: null, visibility: "public", status: "published" }
  };

  try {
    const changed = await bulkPatchTracks(parsed.data.ids, map[parsed.data.action]);
    return ok({ changed, action: parsed.data.action });
  } catch (err) {
    return serverError(err, "Bulk action failed.");
  }
}