import { NextRequest, NextResponse } from "next/server";
import { BACKUP_TOKEN } from "@/server/env";
import { getRepo } from "@/server/store";
import { trustStore } from "@/server/trust/store";
import { fail } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Free-tier safety net. Supabase free has no PITR, so this produces a
 * restorable JSON snapshot. Protect it with a long BACKUP_TOKEN and fetch
 * it on a schedule. Password hashes are deliberately excluded.
 */
export async function GET(req: NextRequest) {
  if (!BACKUP_TOKEN || BACKUP_TOKEN.length < 24) {
    return fail("Backups are disabled. Set BACKUP_TOKEN to a long random string.", 503, "disabled");
  }
  const supplied = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-backup-token") ?? "";
  if (supplied !== BACKUP_TOKEN) return fail("Invalid backup token.", 401, "unauthorized");

  try {
    const repo = getRepo();
    const [profiles, trust] = await Promise.all([repo.listProfiles(), trustStore().all()]);
    const tracks = (await Promise.all(profiles.map((p) => repo.tracksByUser(p.id)))).flat();
    const comments = await repo.commentsForTracks(tracks.map((t) => t.id));

    const snapshot = {
      format: "iloveaimusic-backup",
      version: 1,
      takenAt: new Date().toISOString(),
      counts: { profiles: profiles.length, tracks: tracks.length, comments: comments.length, reports: trust.reports.length },
      profiles: profiles.map((p) => ({ ...p, pass_hash: undefined })),
      tracks, comments,
      trust: { reports: trust.reports, rights: trust.rights, strikes: trust.strikes, actions: trust.actions, roles: trust.roles },
      note: "Media files are NOT included. Back up the storage buckets (or .data/media) separately."
    };

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="iloveaimusic-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Backup failed.", 500, "server");
  }
}