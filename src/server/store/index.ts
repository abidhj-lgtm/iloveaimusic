import "server-only";
import { DB_MODE, assertProductionConfig } from "../env";
import { createLocalRepo } from "./local";
import { createSupabaseRepo } from "./supabase";
import type { Repo, ProfileRow, TrackRow, CommentRow } from "./types";

let repo: Repo | null = null;
export function getRepo(): Repo {
  assertProductionConfig();
  if (!repo) repo = DB_MODE === "supabase" ? createSupabaseRepo() : createLocalRepo();
  return repo;
}

export interface ClientUser {
  id: string; name: string; handle: string; email: string; verified: boolean;
  provider: "email" | "google" | "demo"; bio: string; avatarPalette: number; createdAt: number;
}
export interface PublicProfile {
  id: string; name: string; handle: string; bio: string;
  avatarPalette: number; createdAt: number; verified: boolean;
  provider: "email" | "google" | "demo";
}

export const toPublicProfile = (r: ProfileRow): PublicProfile => ({
  id: r.legacy_id ?? r.id, name: r.name, handle: r.handle, bio: r.bio,
  avatarPalette: r.avatar_palette, createdAt: Date.parse(r.created_at),
  verified: r.verified, provider: r.provider
});
export const toPrivateUser = (r: ProfileRow): ClientUser => ({ ...toPublicProfile(r), email: r.email });

export async function resolveProfileId(publicId: string): Promise<string | null> {
  const repo = getRepo();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId);
  if (isUuid) {
    return (await repo.findProfileById(publicId))?.id ?? null;
  } else {
    return (await repo.findProfileByLegacy(publicId))?.id ?? null;
  }
}
export async function resolveTrackId(publicId: string): Promise<string | null> {
  const repo = getRepo();
  
  // UUID format: 8-4-4-4-12 hex chars
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId);
  
  if (isUuid) {
    // It's a UUID — look up by id column
    return (await repo.findTrackById(publicId))?.id ?? null;
  } else {
    // It's a legacy ID like "t-faded" — look up by legacy_id column
    return (await repo.findTrackByLegacy(publicId))?.id ?? null;
  }
}
export interface ClientTrack {
  id: string; userId: string; title: string;
  source: "upload" | "youtube"; youtubeId?: string; live?: boolean;
  audioKey?: string; preset?: "synthwave" | "lofi" | "ambient";
  thumbKey?: string; coverSeed: string; coverPalette: number;
  background: string; stylePrompt: string; lyrics: string; instrumental: boolean;
  duration?: number; plays: number; baseLikes: number;
  createdAt: number; updatedAt?: number;
}
export interface ClientComment { id: string; trackId: string; userId: string; text: string; createdAt: number }

export function toClientTrack(r: TrackRow, ownerPublicId: string, likeCount: number, likedByMe: boolean): ClientTrack {
  return {
    id: r.legacy_id ?? r.id, userId: ownerPublicId, title: r.title, source: r.source,
    youtubeId: r.youtube_id ?? undefined, live: r.is_live || undefined,
    audioKey: r.audio_path ? `/api/media/audio/${encodeURIComponent(r.audio_path)}` : undefined,
    preset: r.preset ?? undefined,
    thumbKey: r.cover_path ? `/api/media/cover/${encodeURIComponent(r.cover_path)}` : undefined,
    coverSeed: r.cover_seed, coverPalette: r.cover_palette, background: r.background,
    stylePrompt: r.style_prompt, lyrics: r.lyrics, instrumental: r.instrumental,
    duration: r.duration ?? undefined, plays: r.plays,
    baseLikes: Math.max(0, likeCount - (likedByMe ? 1 : 0)),
    createdAt: Date.parse(r.created_at),
    updatedAt: r.updated_at && r.updated_at !== r.created_at ? Date.parse(r.updated_at) : undefined
  };
}
export const toClientComment = (c: CommentRow, ownerPublicId: string, trackPublicId: string): ClientComment => ({
  id: c.id, trackId: trackPublicId, userId: ownerPublicId, text: c.body, createdAt: Date.parse(c.created_at)
});

export type { Repo, ProfileRow, TrackRow, CommentRow };