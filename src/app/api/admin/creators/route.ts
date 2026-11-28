import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { adminIdentity, listCreators, type CreatorFilter, type CreatorSort } from "@/server/store/admin";

export const dynamic = "force-dynamic";

const FILTERS = new Set(["all", "active", "empty", "staff", "official", "suspended", "unverified"]);
const SORTS = new Set(["plays", "tracks", "likes", "newest", "oldest", "name"]);

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Admin console needs Supabase mode.", 501, "mode");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const { profile } = await adminIdentity(viewer?.id ?? null);
    if (!profile) return fail("Staff access required.", 403, "forbidden");

    const p = req.nextUrl.searchParams;
    const filter = FILTERS.has(p.get("filter") ?? "") ? (p.get("filter") as CreatorFilter) : "all";
    const sort = SORTS.has(p.get("sort") ?? "") ? (p.get("sort") as CreatorSort) : "plays";

    const page = await listCreators({
      search: (p.get("q") ?? "").slice(0, 120),
      filter, sort,
      page: Number(p.get("page") ?? 1) || 1,
      perPage: Number(p.get("perPage") ?? 25) || 25
    });

    return ok({ ...page, role: profile.role });
  } catch (err) {
    return serverError(err, "Could not load creators.");
  }
}