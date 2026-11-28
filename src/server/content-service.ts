import "server-only";
import { getRepo, resolveProfileId, resolveTrackId, toClientTrack, toClientComment, toPublicProfile, type ClientTrack, type ClientComment, type TrackRow, type ProfileRow } from "./store";
import { CATALOG_ARTISTS, CATALOG_TRACKS, CATALOG_COMMENTS, CATALOG_LIKES, CATALOG_FOLLOWS } from "@/lib/catalog";
import { hashPassword, ipHash } from "./crypto";
import { reportError } from "./observability";
import type { FeedQuery } from "./store/types";

const SEED_KEY = "catalog_seeded_v1";
let seedPromise: Promise<void> | null = null;

/** Runs once per process, and once ever per database — not once per request. */
export function ensureCatalogSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const repo = getRepo();
      const marker = await repo.getMeta(SEED_KEY);
      if (marker?.done) return;
      if ((await repo.countTracks()) > 0) { await repo.setMeta(SEED_KEY, { done: true, at: new Date().toISOString() }); return; }
      await seedCatalog();
      await repo.setMeta(SEED_KEY, { done: true, at: new Date().toISOString() });
    })().catch((err) => { seedPromise = null; reportError(err, { route: "seed" }); });
  }
  return seedPromise;
}

async function seedCatalog(): Promise<void> {
  const repo = getRepo();
  const pass = await hashPassword("demo1234");
  const idByLegacy = new Map<string, string>();

  for (const a of CATALOG_ARTISTS) {
    const row = (await repo.findProfileByLegacy(a.id))
      ?? (await repo.findProfileByEmail(a.email))
      ?? await repo.createProfile({
        email: a.email, name: a.name, handle: a.handle, bio: a.bio,
        avatar_palette: a.avatarPalette, provider: a.provider === "demo" ? "demo" : "email",
        verified: true, pass_hash: pass, legacy_id: a.id
      });
    idByLegacy.set(a.id, row.id);
  }

  const trackIds = new Map<string, string>();
  for (const t of CATALOG_TRACKS) {
    const existing = await repo.findTrackByLegacy(t.id);
    if (existing) { trackIds.set(t.id, existing.id); continue; }
    const created = await repo.createTrack({
      user_id: idByLegacy.get(t.userId)!, legacy_id: t.id, title: t.title, source: t.source,
      youtube_id: t.youtubeId ?? null, is_live: !!t.live, preset: t.preset ?? null,
      cover_seed: t.coverSeed, cover_palette: t.coverPalette, background: t.background,
      style_prompt: t.stylePrompt, lyrics: t.lyrics, instrumental: t.instrumental,
      duration: t.duration ?? null, plays: t.plays,
      created_at: new Date(t.createdAt).toISOString(), published_at: new Date(t.createdAt).toISOString()
    });
    trackIds.set(t.id, created.id);
  }

  for (const c of CATALOG_COMMENTS) {
    const tid = trackIds.get(c.trackId), uid = idByLegacy.get(c.userId);
    if (tid && uid) await repo.addComment(tid, uid, c.text);
  }
  for (const l of CATALOG_LIKES) {
    const tid = trackIds.get(l.trackId), uid = idByLegacy.get(l.userId);
    if (tid && uid) await repo.setLike(uid, tid, true);
  }
  for (const f of CATALOG_FOLLOWS) {
    const a = idByLegacy.get(f.followerId), b = idByLegacy.get(f.targetId);
    if (a && b) await repo.setFollow(a, b, true);
  }
  for (const t of CATALOG_TRACKS) {
    const tid = trackIds.get(t.id);
    if (tid) await repo.updateTrack(tid, { plays: t.plays });
  }
}

export interface PublicTrackBundle { track: ClientTrack; comments: ClientComment[]; likedByMe: boolean; savedByMe: boolean }

const publicId = (p: ProfileRow) => p.legacy_id ?? p.id;

export async function loadFeed(query: FeedQuery) {
  await ensureCatalogSeeded();
  const repo = getRepo();
  const page = await repo.feed(query);
  const owners = await repo.profilesByIds([...new Set(page.items.flatMap((i) => [i.track.user_id, ...i.comments.map((c) => c.user_id)]))]);
  const names = new Map(owners.map((p) => [p.id, publicId(p)]));
  return {
    items: page.items.map((i) => ({
      track: toClientTrack(i.track, names.get(i.track.user_id) ?? i.track.user_id, i.track.like_count, i.likedByMe),
      comments: i.comments.map((c) => toClientComment(c, names.get(c.user_id) ?? c.user_id, i.track.legacy_id ?? i.track.id)),
      likedByMe: i.likedByMe, savedByMe: i.savedByMe
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore
  };
}

/** One batch query instead of one per liked/saved track. */
export async function loadViewerCollections(viewerRowId: string | null) {
  if (!viewerRowId) return { liked: [] as string[], saved: [] as string[], following: [] as string[] };
  const repo = getRepo();
  const [likedRows, savedRows, followingRows] = await Promise.all([
    repo.likedTrackIds(viewerRowId), repo.savedTrackIds(viewerRowId), repo.followingIds(viewerRowId)
  ]);
  const [tracks, profiles] = await Promise.all([
    repo.tracksByIds([...new Set([...likedRows, ...savedRows])]),
    repo.profilesByIds(followingRows)
  ]);
  const trackPub = new Map(tracks.map((t) => [t.id, t.legacy_id ?? t.id]));
  const profPub = new Map(profiles.map((p) => [p.id, publicId(p)]));
  return {
    liked: likedRows.map((id) => trackPub.get(id) ?? id),
    saved: savedRows.map((id) => trackPub.get(id) ?? id),
    following: followingRows.map((id) => profPub.get(id) ?? id)
  };
}

export async function createTrackForUser(ownerRowId: string, input: {
  title: string; source: "upload" | "youtube"; youtubeId?: string; live?: boolean;
  preset?: "synthwave" | "lofi" | "ambient"; audioPath?: string; audioMime?: string; audioBytes?: number;
  coverPath?: string; coverSeed: string; coverPalette: number; background: string;
  stylePrompt: string; lyrics: string; instrumental: boolean; duration?: number;
}, ip: string): Promise<PublicTrackBundle> {
  const repo = getRepo();
  const row = await repo.createTrack({
    user_id: ownerRowId, title: input.title, source: input.source,
    youtube_id: input.youtubeId ?? null, is_live: !!input.live, preset: input.preset ?? null,
    audio_path: input.audioPath ?? null, audio_mime: input.audioMime ?? null, audio_bytes: input.audioBytes ?? null,
    cover_path: input.coverPath ?? null, cover_seed: input.coverSeed, cover_palette: input.coverPalette,
    background: input.background, style_prompt: input.stylePrompt,
    lyrics: input.instrumental ? "" : input.lyrics, instrumental: input.instrumental, duration: input.duration ?? null
  });
  await repo.audit(ownerRowId, "track.create", row.id, { title: row.title, source: row.source }, ip);

  // Auto-tag the track based on prompt and background
  try {
    const { autoTagTrack } = await import("@/server/tagging");
    await autoTagTrack(row.id, input.stylePrompt, input.background);
  } catch (err) {
    // Auto-tagging failure should not break track creation
    reportError(err, { route: "content:createTrack:autoTag", trackId: row.id });
  }

  const owner = await repo.findProfileById(ownerRowId);
  return { track: toClientTrack(row, owner ? publicId(owner) : ownerRowId, 0, false), comments: [], likedByMe: false, savedByMe: false };
}

export async function getTrackBundle(id: string, viewerRowId: string | null): Promise<PublicTrackBundle | null> {
  await ensureCatalogSeeded();
  const repo = getRepo();
  const realId = await resolveTrackId(id);
  if (!realId) return null;
  const row = await repo.findTrackById(realId);
  if (!row || row.deleted_at) return null;
  const [comments, owner] = await Promise.all([repo.commentsForTracks([realId]), repo.findProfileById(row.user_id)]);
  const commenters = await repo.profilesByIds([...new Set(comments.map((c) => c.user_id))]);
  const names = new Map(commenters.map((p) => [p.id, publicId(p)]));
  const likedByMe = viewerRowId ? await repo.isLiked(viewerRowId, realId) : false;
  const savedByMe = viewerRowId ? await repo.isSaved(viewerRowId, realId) : false;
  return {
    track: toClientTrack(row, owner ? publicId(owner) : row.user_id, row.like_count, likedByMe),
    comments: comments.map((c) => toClientComment(c, names.get(c.user_id) ?? c.user_id, row.legacy_id ?? row.id)),
    likedByMe, savedByMe
  };
}

export async function assertTrackOwner(id: string, viewerRowId: string | null) {
  const realId = await resolveTrackId(id);
  if (!realId) return { error: "Track not found.", status: 404 } as const;
  const row = await getRepo().findTrackById(realId);
  if (!row) return { error: "Track not found.", status: 404 } as const;
  if (!viewerRowId || row.user_id !== viewerRowId) return { error: "You can only change your own tracks.", status: 403 } as const;
  return { realId, row } as const;
}

export async function publicProfiles() {
  await ensureCatalogSeeded();
  return (await getRepo().listProfiles()).map(toPublicProfile);
}

export interface CatalogEntry {
  id: string; title: string; userId: string; artistName: string; artistHandle: string;
  artistPalette: number; artistBio: string; source: "upload" | "youtube"; youtubeId?: string;
  preset?: "synthwave" | "lofi" | "ambient"; coverSeed: string; coverPalette: number;
  background: string; stylePrompt: string; instrumental: boolean; duration?: number;
  plays: number; likes: number; createdAt: number; updatedAt: number;
}

/** Single source for sitemap, RSS, llms.txt and /discover. Two queries total. */
export async function publicCatalog(limit = 2000): Promise<{ entries: CatalogEntry[]; total: number }> {
  await ensureCatalogSeeded();
  const repo = getRepo();
  const [rows, profiles, total] = await Promise.all([
    repo.listPublicTracks(limit), repo.listProfiles(), repo.countPublicTracks()
  ]);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const entries = rows.map((t) => {
    const p = byId.get(t.user_id);
    return {
      id: t.legacy_id ?? t.id, title: t.title, userId: p ? publicId(p) : t.user_id,
      artistName: p?.name ?? "Unknown artist", artistHandle: p?.handle ?? "unknown",
      artistPalette: p?.avatar_palette ?? 0, artistBio: p?.bio ?? "",
      source: t.source, youtubeId: t.youtube_id ?? undefined, preset: t.preset ?? undefined,
      coverSeed: t.cover_seed, coverPalette: t.cover_palette, background: t.background,
      stylePrompt: t.style_prompt, instrumental: t.instrumental, duration: t.duration ?? undefined,
      plays: t.plays, likes: t.like_count,
      createdAt: Date.parse(t.created_at), updatedAt: Date.parse(t.updated_at ?? t.created_at)
    };
  });
  return { entries, total };
}

export async function artistCatalog(handle: string) {
  await ensureCatalogSeeded();
  const repo = getRepo();
  const profile = await repo.findProfileByHandle(handle);
  if (!profile) return null;
  const rows = await repo.tracksByUser(profile.id);
  return { profile, rows: rows.filter((r) => r.status === "published") };
}

export const hashIp = ipHash;
export { resolveProfileId, resolveTrackId };
export type { TrackRow };