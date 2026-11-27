import "server-only";
import { SUPABASE_URL, SUPABASE_KEY } from "../env";
import { reportError } from "../observability";

const root = () => SUPABASE_URL.replace(/\/+$/, "");
const rest = () => `${root()}/rest/v1`;
const nowIso = () => new Date().toISOString();

const H = (extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  ...extra
});

const eq = (v: string) => `eq.${v}`;
const NULL = "is.null";
const inList = (ids: string[]) => `in.(${ids.map((i) => `"${i}"`).join(",")})`;

function url(table: string, o: { filters?: Record<string, string>; order?: string; limit?: number; select?: string; offset?: number } = {}) {
  const p = new URLSearchParams();
  p.set("select", o.select ?? "*");
  for (const [k, v] of Object.entries(o.filters ?? {})) p.set(k, v);
  if (o.order) p.set("order", o.order);
  if (o.limit !== undefined) p.set("limit", String(o.limit));
  if (o.offset !== undefined) p.set("offset", String(o.offset));
  return `${rest()}/${table}?${p.toString()}`;
}

async function call(table: string, method: "GET" | "POST" | "PATCH" | "DELETE", o: Parameters<typeof url>[1] = {}, body?: unknown, prefer?: string): Promise<any[]> {
  const res = await fetch(url(table, o), {
    method,
    headers: H(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j?.message ?? j?.hint ?? text; } catch { /* raw */ }
    const err = new Error(`Supabase ${table} ${method} (${res.status}): ${detail}`);
    reportError(err, { route: `features:${table}`, status: res.status });
    throw err;
  }
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function one<T>(table: string, filters: Record<string, string>): Promise<T | null> {
  return ((await call(table, "GET", { filters, limit: 1 }))[0] as T) ?? null;
}

async function rpcRows<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(`${rest()}/rpc/${fn}`, {
    method: "POST", headers: H(), body: JSON.stringify(args), cache: "no-store"
  });
  if (!res.ok) {
    reportError(new Error(`rpc ${fn} failed (${res.status})`), { route: `features:rpc:${fn}` });
    return [];
  }
  const text = await res.text();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed as T[] : [parsed as T];
}

/* ---------------- row types ---------------- */

export interface PlaylistRow {
  id: string; user_id: string; title: string; description: string;
  cover_path: string | null; cover_seed: string; cover_palette: number;
  is_public: boolean; track_count: number; created_at: string; updated_at: string;
}
export interface PlaylistTrackRow {
  id: string; playlist_id: string; track_id: string; position: number; added_at: string;
}
export type NotificationKind = "like" | "comment" | "follow" | "playlist_add" | "system";
export interface NotificationRow {
  id: string; user_id: string; kind: NotificationKind;
  actor_id: string | null; track_id: string | null; playlist_id: string | null; comment_id: string | null;
  read_at: string | null; created_at: string;
}
export interface PlaySeriesPoint { day: string; plays: number; unique_listeners: number }
export interface TopTrackPoint { track_id: string; title: string; plays: number; unique_listeners: number }

export interface NewPlaylist {
  user_id: string; title: string; description?: string;
  cover_seed?: string; cover_palette?: number; is_public?: boolean;
}

/* ---------------- playlists ---------------- */

export async function createPlaylist(input: NewPlaylist): Promise<PlaylistRow> {
  const rows = await call("playlists", "POST", {}, {
    user_id: input.user_id,
    title: input.title,
    description: input.description ?? "",
    cover_seed: input.cover_seed ?? "",
    cover_palette: input.cover_palette ?? 0,
    is_public: input.is_public ?? true
  }, "return=representation");
  if (!rows[0]) throw new Error("playlist insert returned no row");
  return rows[0] as PlaylistRow;
}

export async function findPlaylist(id: string): Promise<PlaylistRow | null> {
  return one<PlaylistRow>("playlists", { id: eq(id) });
}

export async function playlistsByUser(userId: string, limit = 100): Promise<PlaylistRow[]> {
  return await call("playlists", "GET", {
    filters: { user_id: eq(userId) }, order: "created_at.desc", limit
  }) as PlaylistRow[];
}

export async function publicPlaylists(limit = 24): Promise<PlaylistRow[]> {
  return await call("playlists", "GET", {
    filters: { is_public: "eq.true" }, order: "created_at.desc", limit
  }) as PlaylistRow[];
}

export async function updatePlaylist(id: string, patch: Partial<Pick<PlaylistRow, "title" | "description" | "is_public" | "cover_path" | "cover_seed" | "cover_palette">>): Promise<PlaylistRow> {
  const rows = await call("playlists", "PATCH", { filters: { id: eq(id) } },
    { ...patch, updated_at: nowIso() }, "return=representation");
  if (!rows[0]) throw new Error("playlist-not-found");
  return rows[0] as PlaylistRow;
}

export async function deletePlaylist(id: string): Promise<void> {
  await call("playlists", "DELETE", { filters: { id: eq(id) } });
}

export async function playlistTrackRows(playlistId: string): Promise<PlaylistTrackRow[]> {
  return await call("playlist_tracks", "GET", {
    filters: { playlist_id: eq(playlistId) }, order: "position.asc,added_at.asc", limit: 500
  }) as PlaylistTrackRow[];
}

export async function playlistTrackIds(playlistId: string): Promise<string[]> {
  const rows = await call("playlist_tracks", "GET", {
    select: "track_id", filters: { playlist_id: eq(playlistId) }, order: "position.asc", limit: 500
  }) as { track_id: string }[];
  return rows.map((r) => r.track_id);
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const existing = await one<PlaylistTrackRow>("playlist_tracks", {
    playlist_id: eq(playlistId), track_id: eq(trackId)
  });
  if (existing) return false;
  const tail = await call("playlist_tracks", "GET", {
    select: "position", filters: { playlist_id: eq(playlistId) }, order: "position.desc", limit: 1
  }) as { position: number }[];
  const next = (tail[0]?.position ?? -1) + 1;
  await call("playlist_tracks", "POST", {}, { playlist_id: playlistId, track_id: trackId, position: next });
  return true;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  await call("playlist_tracks", "DELETE", {
    filters: { playlist_id: eq(playlistId), track_id: eq(trackId) }
  });
}

/** Rewrite positions to match the given order. Idempotent; unknown ids ignored. */
export async function reorderPlaylist(playlistId: string, orderedTrackIds: string[]): Promise<void> {
  const rows = await playlistTrackRows(playlistId);
  const known = new Set(rows.map((r) => r.track_id));
  let pos = 0;
  for (const trackId of orderedTrackIds) {
    if (!known.has(trackId)) continue;
    const row = rows.find((r) => r.track_id === trackId)!;
    if (row.position !== pos) {
      await call("playlist_tracks", "PATCH", { filters: { id: eq(row.id) } }, { position: pos });
    }
    known.delete(trackId);
    pos++;
  }
  for (const leftover of known) {
    const row = rows.find((r) => r.track_id === leftover)!;
    await call("playlist_tracks", "PATCH", { filters: { id: eq(row.id) } }, { position: pos++ });
  }
}

export async function playlistsContainingTrack(userId: string, trackId: string): Promise<string[]> {
  const mine = await playlistsByUser(userId, 200);
  if (!mine.length) return [];
  const rows = await call("playlist_tracks", "GET", {
    select: "playlist_id",
    filters: { playlist_id: inList(mine.map((p) => p.id)), track_id: eq(trackId) },
    limit: 200
  }) as { playlist_id: string }[];
  return rows.map((r) => r.playlist_id);
}

/* ---------------- notifications ---------------- */

export async function notify(input: {
  userId: string; kind: NotificationKind; actorId?: string | null;
  trackId?: string | null; playlistId?: string | null; commentId?: string | null;
}): Promise<void> {
  if (!input.actorId || input.actorId === input.userId) return;
  try {
    await call("notifications", "POST", {}, {
      user_id: input.userId, kind: input.kind,
      actor_id: input.actorId, track_id: input.trackId ?? null,
      playlist_id: input.playlistId ?? null, comment_id: input.commentId ?? null
    }, "resolution=ignore-duplicates,return=minimal");
  } catch (err) {
    // A notification must never break the action that triggered it.
    reportError(err, { route: "features:notify" });
  }
}

export async function notificationsFor(userId: string, limit = 30, offset = 0): Promise<NotificationRow[]> {
  return await call("notifications", "GET", {
    filters: { user_id: eq(userId) }, order: "created_at.desc", limit, offset
  }) as NotificationRow[];
}

export async function unreadCount(userId: string): Promise<number> {
  const res = await fetch(url("notifications", {
    select: "id", filters: { user_id: eq(userId), read_at: NULL }, limit: 1
  }), { method: "GET", headers: H({ Prefer: "count=exact" }), cache: "no-store" });
  if (!res.ok) return 0;
  const total = Number((res.headers.get("content-range") ?? "").split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function markRead(id: string, userId: string): Promise<void> {
  await call("notifications", "PATCH", {
    filters: { id: eq(id), user_id: eq(userId), read_at: NULL }
  }, { read_at: nowIso() });
}

export async function markAllRead(userId: string): Promise<void> {
  await call("notifications", "PATCH", {
    filters: { user_id: eq(userId), read_at: NULL }
  }, { read_at: nowIso() });
}

/* ---------------- tags ---------------- */

export async function tagsForTracks(trackIds: string[]): Promise<{ track_id: string; tag: string }[]> {
  if (!trackIds.length) return [];
  return await call("track_tags", "GET", {
    filters: { track_id: inList(trackIds) }, limit: 2000
  }) as { track_id: string; tag: string }[];
}

export async function setTrackTags(trackId: string, tags: string[]): Promise<void> {
  await call("track_tags", "DELETE", { filters: { track_id: eq(trackId) } });
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 40))].slice(0, 12);
  if (!clean.length) return;
  await call("track_tags", "POST", {}, clean.map((tag) => ({ track_id: trackId, tag })));
}

/* ---------------- analytics ---------------- */

export async function trackSeries(trackId: string, days = 30): Promise<PlaySeriesPoint[]> {
  return rpcRows<PlaySeriesPoint>("track_play_series", { p_track_id: trackId, p_days: days });
}

export async function userSeries(userId: string, days = 30): Promise<PlaySeriesPoint[]> {
  return rpcRows<PlaySeriesPoint>("user_play_series", { p_user_id: userId, p_days: days });
}

export async function userTopTracks(userId: string, days = 30, limit = 10): Promise<TopTrackPoint[]> {
  return rpcRows<TopTrackPoint>("user_top_tracks", { p_user_id: userId, p_days: days, p_limit: limit });
}

export async function getOrCreateSavedPlaylist(userId: string): Promise<string> {
  const existing = await playlistsByUser(userId, 100);
  const saved = existing.find((p) => p.title === "Saved Tracks");
  if (saved) return saved.id;
  
  const newPl = await createPlaylist({
    user_id: userId,
    title: "Saved Tracks",
    description: "Tracks you've saved.",
    cover_seed: "saved-tracks",
    cover_palette: 1,
    is_public: false
  });
  return newPl.id;
}

export async function toggleTrackInSavedPlaylist(userId: string, trackId: string, shouldSave: boolean): Promise<void> {
  const playlistId = await getOrCreateSavedPlaylist(userId);
  if (shouldSave) {
    await addTrackToPlaylist(playlistId, trackId);
  } else {
    await removeTrackFromPlaylist(playlistId, trackId);
  }
}

export async function searchPlaylists(query: string, limit = 10): Promise<PlaylistRow[]> {
  const safe = query.replace(/[(),"]/g, "").replace(/\s+/g, " ").trim();
  if (!safe) return [];
  const res = await fetch(
    `${rest()}/playlists?select=*&is_public=eq.true&or=(title.ilike.*${safe}*,description.ilike.*${safe}*)&order=created_at.desc&limit=${limit}`,
    { headers: H(), cache: "no-store" }
  );
  if (!res.ok) return [];
  const text = await res.text();
  if (!text) return [];
  return JSON.parse(text) as PlaylistRow[];
}

/* ---------------- playlist follows ---------------- */

export async function isFollowingPlaylist(userId: string, playlistId: string): Promise<boolean> {
  const row = await selectOne<{ id: string }>("playlist_follows", {
    playlist_id: eq(playlistId),
    user_id: eq(userId)
  });
  return !!row;
}

export async function followPlaylist(userId: string, playlistId: string): Promise<void> {
  const existing = await isFollowingPlaylist(userId, playlistId);
  if (!existing) {
    await call("playlist_follows", "POST", {}, { playlist_id: playlistId, user_id: userId });
  }
}

export async function unfollowPlaylist(userId: string, playlistId: string): Promise<void> {
  await call("playlist_follows", "DELETE", {
    filters: { playlist_id: eq(playlistId), user_id: eq(userId) }
  });
}

export async function followerCount(playlistId: string): Promise<number> {
  return countOf("playlist_follows", { playlist_id: eq(playlistId) });
}

/* ---------------- system announcements ---------------- */

export async function broadcastAnnouncement(input: {
  title: string; body: string; link: string | null;
  created_by: string; expires_at: string | null;
}): Promise<number> {
  // Record the announcement itself
  const rows = await call("system_announcements", "POST", {}, {
    title: input.title,
    body: input.body,
    link: input.link,
    created_by: input.created_by,
    expires_at: input.expires_at
  }, "return=representation");
  const announcement = rows[0];
  if (!announcement) return 0;

  // Fan out to every user as a notification (best-effort, ignore failures)
  const users = await call("profiles", "GET", {
    select: "id",
    filters: { id: `neq.${input.created_by}` },
    limit: 5000
  }) as { id: string }[];

  let sent = 0;
  for (const u of users) {
    try {
      await call("notifications", "POST", {}, {
        user_id: u.id,
        kind: "system",
        actor_id: input.created_by,
        track_id: null,
        playlist_id: null,
        comment_id: null
      }, "resolution=ignore-duplicates,return=minimal");
      sent++;
    } catch { /* ignore per-user failures */ }
  }
  return sent;
}

/* ---------------- notification cleanup ---------------- */

export async function cleanupOldNotifications(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${rest()}/notifications?created_at=lt.${cutoff}`,
    { method: "DELETE", headers: H(), cache: "no-store" }
  );
  if (!res.ok) return 0;
  // PostgREST returns no body for DELETE; use content-range if available
  const range = res.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}