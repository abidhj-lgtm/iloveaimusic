import "server-only";
import { getRepo, resolveTrackId } from "../store";
import { ensureTrustSeeded } from "./service";
import { trustStore } from "./store";
import { REASON_LABEL } from "./types";
import type { ConsoleReport } from "./service";

/**
 * Batched moderation queue. Replaces the per-artist fan-out:
 * 4 queries total regardless of how many artists or reports exist.
 */
export async function consoleQueueFast() {
  await ensureTrustSeeded();
  const repo = getRepo();
  const store = trustStore();

  const [state, profiles] = await Promise.all([store.all(), repo.listProfiles()]);
  const pub = new Map(profiles.map((p) => [p.id, p]));

  const trackIds = [...new Set(state.reports.map((r) => r.track_id).filter(Boolean) as string[])];
  const ownerIds = [...new Set(profiles.map((p) => p.id))];

  const [reportTracks, allTracks] = await Promise.all([
    repo.tracksByIds(trackIds),
    repo.tracksForUsers(ownerIds)
  ]);
  const trackMap = new Map(reportTracks.map((t) => [t.id, t]));

  const commentIds = [...new Set(state.reports.map((r) => r.comment_id).filter(Boolean) as string[])];
  const commentBodies = new Map<string, string>();
  if (commentIds.length) {
    const rows = await repo.commentsByIds(commentIds);  // includes soft-deleted
    for (const c of rows) commentBodies.set(c.id, c.body);
  }

  const strikeCount = (userId: string) =>
    state.strikes.filter((s) => s.user_id === userId && !s.revoked_at).reduce((a, s) => a + s.weight, 0);
  const rightsMap = new Map(state.rights.map((r) => [r.track_id, r]));

  const reports: ConsoleReport[] = state.reports.map((r) => {
    const t = r.track_id ? trackMap.get(r.track_id) : undefined;
    const owner = r.target_owner ? pub.get(r.target_owner) : undefined;
    const reporter = r.reporter_id ? pub.get(r.reporter_id) : undefined;
    return {
      id: r.id, reason: r.reason, reasonLabel: REASON_LABEL[r.reason], details: r.details,
      status: r.status, createdAt: Date.parse(r.created_at),
      resolvedAt: r.resolved_at ? Date.parse(r.resolved_at) : null,
      resolutionNote: r.resolution_note,
      track: t ? { id: t.legacy_id ?? t.id, title: t.title, coverSeed: t.cover_seed, coverPalette: t.cover_palette, source: t.source, youtubeId: t.youtube_id ?? undefined, status: t.status, plays: t.plays } : null,
      owner: owner ? { id: owner.legacy_id ?? owner.id, name: owner.name, handle: owner.handle, avatarPalette: owner.avatar_palette, strikes: strikeCount(owner.id) } : null,
      reporter: reporter ? { id: reporter.legacy_id ?? reporter.id, name: reporter.name, handle: reporter.handle, avatarPalette: reporter.avatar_palette } : null,
      commentText: r.comment_id ? commentBodies.get(r.comment_id) : undefined,
      rights: r.track_id ? rightsMap.get(r.track_id) ?? null : null
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  const perUser = new Map<string, { tracks: number; hidden: number }>();
  for (const t of allTracks) {
    const e = perUser.get(t.user_id) ?? { tracks: 0, hidden: 0 };
    if (!t.deleted_at && t.status === "published") e.tracks++;
    if (t.status === "hidden" || t.status === "removed") e.hidden++;
    perUser.set(t.user_id, e);
  }

  const artists = profiles.map((p) => ({
    id: p.legacy_id ?? p.id, name: p.name, handle: p.handle, avatarPalette: p.avatar_palette,
    strikes: strikeCount(p.id), tracks: perUser.get(p.id)?.tracks ?? 0, hidden: perUser.get(p.id)?.hidden ?? 0
  })).sort((a, b) => b.strikes - a.strikes || b.tracks - a.tracks);

  const activity = state.actions.slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120)
    .map((a) => ({
      id: a.id, batchId: a.batch_id, action: a.action, targetType: a.target_type, targetId: a.target_id,
      note: a.note, actor: a.actor_id ? pub.get(a.actor_id)?.name ?? "Staff" : "System",
      createdAt: Date.parse(a.created_at), undone: !!a.undone_at
    }));

  const dayAgo = Date.now() - 86400_000;
  const published = allTracks.filter((t) => t.status === "published" && !t.deleted_at);
  return {
    reports, artists, activity,
    stats: {
      open: reports.filter((r) => r.status === "open").length,
      reviewing: reports.filter((r) => r.status === "reviewing").length,
      copyright: reports.filter((r) => r.reason === "copyright" && (r.status === "open" || r.status === "reviewing")).length,
      resolvedToday: reports.filter((r) => r.resolvedAt && r.resolvedAt > dayAgo).length,
      hiddenTracks: allTracks.filter((t) => t.status === "hidden" || t.status === "removed").length,
      flaggedArtists: artists.filter((a) => a.strikes > 0).length,
      totalReports: reports.length,
      provenanceGaps: published.filter((t) => !rightsMap.get(t.id)?.attested).length
    }
  };
}

export { resolveTrackId };