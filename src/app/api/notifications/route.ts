import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { notificationsFor, unreadCount } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Notifications need Supabase mode.", 501, "mode");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);

  try {
    const rows = await notificationsFor(viewer.id, limit + 1, offset);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const repo = getRepo();
    const actorIds = [...new Set(page.map((n) => n.actor_id).filter(Boolean))] as string[];
    const trackIds = [...new Set(page.map((n) => n.track_id).filter(Boolean))] as string[];
    const [actors, tracks] = await Promise.all([
      repo.profilesByIds(actorIds),
      repo.tracksByIds(trackIds)
    ]);

    const items = page.map((n) => {
      const a = actors.find((p) => p.id === n.actor_id);
      const t = tracks.find((x) => x.id === n.track_id);
      return {
        id: n.id,
        kind: n.kind,
        createdAt: n.created_at,
        readAt: n.read_at,
        actor: a ? { id: a.id, name: a.name, handle: a.handle, avatarPalette: a.avatar_palette } : null,
        track: t ? { id: t.id, title: t.title } : null,
        playlistId: n.playlist_id,
        commentId: n.comment_id
      };
    });

    return ok({
      items,
      hasMore,
      nextOffset: hasMore ? offset + page.length : null,
      unread: await unreadCount(viewer.id)
    });
  } catch (err) {
    return serverError(err, "Could not load notifications.");
  }
}