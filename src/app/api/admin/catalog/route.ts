import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { roleFor, isStaff, ensureTrustSeeded } from "@/server/trust/service";
import { trustStore } from "@/server/trust/store";
import { fail, ok, readSessionToken, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = await resolveSession(readSessionToken(req));
  const role = await roleFor(viewer);
  if (!isStaff(role)) return fail("Moderator access required.", 403, "forbidden");

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "users" ? "users" : "tracks";
  const q = (sp.get("q") ?? "").slice(0, 120);
  const cursor = sp.get("cursor");
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 25) || 25));

  try {
    await ensureTrustSeeded();
    const repo = getRepo();
    const profiles = await repo.listProfiles();
    const pub = new Map(profiles.map((p) => [p.id, p]));

    if (kind === "users") {
      const sort = (sp.get("sort") ?? "new") as "new" | "old" | "tracks" | "name";
      const page = await repo.adminUsers({ q, sort, cursor, limit });
      const trust = await trustStore().all();
      const counts = await repo.allPublicTracks(2000);
      return ok({
        kind, total: page.total, nextCursor: page.nextCursor,
        rows: page.rows.map((p) => ({
          id: p.legacy_id ?? p.id, name: p.name, handle: p.handle, email: p.email,
          avatarPalette: p.avatar_palette, provider: p.provider, role: p.role,
          verified: p.verified, closed: !!p.deleted_at, createdAt: Date.parse(p.created_at),
          tracks: counts.filter((t) => t.user_id === p.id).length,
          strikes: trust.strikes.filter((s) => s.user_id === p.id && !s.revoked_at).reduce((a, s) => a + s.weight, 0)
        }))
      });
    }

    const status = sp.get("status") ?? "all";
    const sort = (sp.get("sort") ?? "new") as "new" | "old" | "played" | "reported";
    const page = await repo.adminTracks({ q, status, sort, cursor, limit });
    const trust = await trustStore().all();
    const rights = new Map(trust.rights.map((r) => [r.track_id, r]));
    const openReports = new Map<string, number>();
    for (const r of trust.reports) {
      if (r.track_id && (r.status === "open" || r.status === "reviewing")) {
        openReports.set(r.track_id, (openReports.get(r.track_id) ?? 0) + 1);
      }
    }
    return ok({
      kind, total: page.total, nextCursor: page.nextCursor,
      rows: page.rows.map((t) => {
        const o = pub.get(t.user_id);
        return {
          id: t.legacy_id ?? t.id, title: t.title, status: t.status, source: t.source,
          youtubeId: t.youtube_id ?? undefined, coverSeed: t.cover_seed, coverPalette: t.cover_palette,
          plays: t.plays, likes: t.like_count, comments: t.comment_count,
          duration: t.duration, createdAt: Date.parse(t.created_at),
          owner: o ? { id: o.legacy_id ?? o.id, name: o.name, handle: o.handle, avatarPalette: o.avatar_palette } : null,
          attested: !!rights.get(t.id)?.attested,
          license: rights.get(t.id)?.license ?? "all_rights_reserved",
          openReports: openReports.get(t.id) ?? 0
        };
      })
    });
  } catch (err) {
    return serverError(err, "Could not load the catalog.");
  }
}