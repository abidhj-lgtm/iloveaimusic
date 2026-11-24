import "server-only";
import { getRepo } from "./store";
import { trustStore } from "./trust/store";
import { ensureTrustSeeded } from "./trust/service";
import { DELETION_GRACE_MS } from "./env";

export async function exportAccount(userId: string) {
  await ensureTrustSeeded();
  const repo = getRepo();
  const profile = await repo.findProfileById(userId);
  if (!profile) return null;

  const [tracks, comments, liked, saved, following, followers, trust] = await Promise.all([
    repo.tracksByUser(userId), repo.commentsByUser(userId), repo.likedTrackIds(userId),
    repo.savedTrackIds(userId), repo.followingIds(userId), repo.followerIds(userId), trustStore().all()
  ]);
  const trackIds = new Set(tracks.map((t) => t.id));

  return {
    exportedAt: new Date().toISOString(),
    format: "ilistenai.account.export.v1",
    profile: {
      id: profile.id, handle: profile.handle, name: profile.name, email: profile.email,
      bio: profile.bio, avatarPalette: profile.avatar_palette, provider: profile.provider,
      role: profile.role, verified: profile.verified, createdAt: profile.created_at
    },
    tracks: tracks.map((t) => ({
      id: t.id, title: t.title, source: t.source, youtubeId: t.youtube_id,
      audioPath: t.audio_path, coverPath: t.cover_path, background: t.background,
      stylePrompt: t.style_prompt, lyrics: t.lyrics, instrumental: t.instrumental,
      duration: t.duration, plays: t.plays, likes: t.like_count,
      status: t.status, createdAt: t.created_at,
      rights: trust.rights.find((r) => r.track_id === t.id) ?? null
    })),
    comments: comments.map((c) => ({ id: c.id, trackId: c.track_id, body: c.body, createdAt: c.created_at, deleted: !!c.deleted_at })),
    likes: liked, saves: saved, following, followers,
    reportsFiled: trust.reports.filter((r) => r.reporter_id === userId).map((r) => ({ id: r.id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at })),
    strikes: trust.strikes.filter((s) => s.user_id === userId).map((s) => ({ reason: s.reason, weight: s.weight, createdAt: s.created_at, revoked: !!s.revoked_at })),
    note: `Audio and cover files are referenced by storage path. Request file copies at hello@ilistenai.music. ${trackIds.size} track(s) included.`
  };
}

export async function deleteAccount(userId: string, ip: string) {
  const repo = getRepo();
  const profile = await repo.findProfileById(userId);
  if (!profile) return { ok: false, error: "Account not found." };
  if (profile.deleted_at) return { ok: false, error: "This account is already closed." };

  const tracks = await repo.tracksByUser(userId);
  await repo.revokeAllSessions(userId);
  await repo.invalidateAuthTokens(userId, "verify");
  await repo.invalidateAuthTokens(userId, "reset");
  await repo.anonymizeProfile(userId);
  await repo.audit(userId, "account.delete", userId, { tracks: tracks.length, graceMs: DELETION_GRACE_MS }, ip);

  return {
    ok: true,
    removedTracks: tracks.length,
    purgeAfter: new Date(Date.now() + DELETION_GRACE_MS).toISOString()
  };
}