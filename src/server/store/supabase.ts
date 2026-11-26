import "server-only";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../env";
import { reportError } from "../observability";
import {
  encodeCursor, decodeCursor,
  type Repo, type ProfileRow, type SessionRow, type AuthTokenRow, type DevMailRow,
  type TrackRow, type CommentRow, type NewProfile, type NewTrack,
  type FeedQuery, type FeedPage, type FeedTrack, type StoredFile, type FeedSort
} from "./types";

const root = () => SUPABASE_URL.replace(/\/+$/, "");
const rest = () => `${root()}/rest/v1`;
const nowIso = () => new Date().toISOString();

interface Q { filters?: Record<string, string>; order?: string; limit?: number; select?: string }

function buildUrl(table: string, o: Q = {}): string {
  const p = new URLSearchParams();
  p.set("select", o.select ?? "*");
  for (const [k, v] of Object.entries(o.filters ?? {})) p.set(k, v);
  if (o.order) p.set("order", o.order);
  if (o.limit !== undefined) p.set("limit", String(o.limit));
  return `${rest()}/${table}?${p.toString()}`;
}

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: "application/json", "Content-Type": "application/json", ...extra
});

async function raw(table: string, method: string, o: Q, body?: unknown, prefer?: string): Promise<Response> {
  try {
    return await fetch(buildUrl(table, o), {
      method, headers: headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"
    });
  } catch (err) {
    reportError(err, { route: `supabase:${table}`, method });
    throw new Error(`Cannot reach Supabase at ${SUPABASE_URL}.`);
  }
}

async function call(table: string, method: "GET" | "POST" | "PATCH" | "DELETE", o: Q = {}, body?: unknown, prefer?: string): Promise<any[]> {
  const res = await raw(table, method, o, body, prefer);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j?.message ?? j?.hint ?? text; } catch { /* raw */ }
    const err = new Error(`Supabase ${table} ${method} (${res.status}): ${detail}`);
    reportError(err, { route: `supabase:${table}`, status: res.status });
    throw err;
  }
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** Exact count from Content-Range — one row transferred, not the whole table. */
async function countOf(table: string, filters: Record<string, string>): Promise<number> {
  const res = await raw(table, "GET", { select: "id", filters, limit: 1 }, undefined, "count=exact");
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${rest()}/rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify(args), cache: "no-store" });
    return res.ok;
  } catch { return false; }
}

const eq = (v: string) => `eq.${v}`;
const NULL = "is.null";
const inList = (ids: string[]) => `in.(${ids.map((i) => `"${i}"`).join(",")})`;
const quote = (v: string | number) => typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`;

async function selectOne<T>(table: string, filters: Record<string, string>): Promise<T | null> {
  return ((await call(table, "GET", { filters, limit: 1 }))[0] as T) ?? null;
}
async function insertOne<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const rows = await call(table, "POST", {}, values, "return=representation");
  if (!rows[0]) throw new Error(`Supabase ${table} insert returned no row.`);
  return rows[0] as T;
}
async function updateRows<T>(table: string, filters: Record<string, string>, patch: Record<string, unknown>): Promise<T[]> {
  return (await call(table, "PATCH", { filters }, patch, "return=representation")) as T[];
}
async function deleteRows(table: string, filters: Record<string, string>): Promise<void> {
  await fetch(buildUrl(table, { filters }), { method: "DELETE", headers: headers(), cache: "no-store" });
}

const ORDER: Record<FeedSort, string> = {
  new: "created_at.desc,id.desc", old: "created_at.asc,id.asc",
  liked: "like_count.desc,id.desc", played: "plays.desc,id.desc"
};
const KEYCOL: Record<FeedSort, string> = { new: "created_at", old: "created_at", liked: "like_count", played: "plays" };
const PUBLIC: Record<string, string> = { status: eq("published"), visibility: eq("public"), deleted_at: NULL };

export function createSupabaseRepo(): Repo {
  const decorate = async (rows: TrackRow[], viewerId: string | null): Promise<FeedTrack[]> => {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const comments = (await call("comments", "GET", { filters: { track_id: inList(ids), deleted_at: NULL }, order: "created_at.asc", limit: 1000 })) as CommentRow[];
    let liked = new Set<string>(), saved = new Set<string>();
    if (viewerId) {
      const [l, s] = await Promise.all([
        call("likes", "GET", { select: "track_id", filters: { user_id: eq(viewerId), track_id: inList(ids) }, limit: 1000 }),
        call("saves", "GET", { select: "track_id", filters: { user_id: eq(viewerId), track_id: inList(ids) }, limit: 1000 })
      ]);
      liked = new Set((l as { track_id: string }[]).map((x) => x.track_id));
      saved = new Set((s as { track_id: string }[]).map((x) => x.track_id));
    }
    return rows.map((t) => ({ track: t, likedByMe: liked.has(t.id), savedByMe: saved.has(t.id), comments: comments.filter((c) => c.track_id === t.id).slice(-50) }));
  };

  const recount = async (trackId: string) => {
    if (await rpc("recount_comments", { p_track_id: trackId })) {
      const n = await countOf("likes", { track_id: eq(trackId) });
      await updateRows("tracks", { id: eq(trackId) }, { like_count: n });
      return n;
    }
    const [likes, comments] = await Promise.all([
      countOf("likes", { track_id: eq(trackId) }),
      countOf("comments", { track_id: eq(trackId), deleted_at: NULL })
    ]);
    await updateRows("tracks", { id: eq(trackId) }, { like_count: likes, comment_count: comments });
    return likes;
  };

  return {
    async getMeta(key) {
      const row = await selectOne<{ value: Record<string, unknown> }>("app_meta", { key: eq(key) });
      return row?.value ?? null;
    },
    async setMeta(key, value) {
      const res = await fetch(`${rest()}/app_meta?on_conflict=key`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ key, value, updated_at: nowIso() }), cache: "no-store"
      });
      if (!res.ok) throw new Error(`app_meta upsert failed: ${await res.text()}`);
    },

    async listProfiles() { return (await call("profiles", "GET", { order: "created_at.asc", limit: 1000 })) as ProfileRow[]; },
    async profilesByIds(ids) {
      if (!ids.length) return [];
      return (await call("profiles", "GET", { filters: { id: inList(ids) }, limit: 1000 })) as ProfileRow[];
    },
    async findProfileByEmail(e) { return selectOne<ProfileRow>("profiles", { email: eq(e.toLowerCase()) }); },
    async findProfileById(id) { return selectOne<ProfileRow>("profiles", { id: eq(id) }); },
    async findProfileByLegacy(l) { return selectOne<ProfileRow>("profiles", { legacy_id: eq(l) }); },
    async findProfileByHandle(h) { return selectOne<ProfileRow>("profiles", { handle: eq(h.toLowerCase()) }); },
    async searchProfileIds(q, limit) {
      const safe = q.replace(/[(),*]/g, " ").trim();
      if (!safe) return [];
      const rows = (await call("profiles", "GET", { select: "id", filters: { or: `(name.ilike.*${safe}*,handle.ilike.*${safe}*)` }, limit })) as { id: string }[];
      return rows.map((r) => r.id);
    },
    async handleTaken(h) { return !!(await selectOne<{ id: string }>("profiles", { handle: eq(h.toLowerCase()) })); },
    async createProfile(input: NewProfile) {
      return insertOne<ProfileRow>("profiles", {
        email: input.email.toLowerCase(), name: input.name, handle: input.handle.toLowerCase(),
        bio: input.bio ?? "", avatar_palette: input.avatar_palette ?? 0,
        provider: input.provider ?? "email", role: input.role ?? "creator",
        verified: input.verified ?? false, pass_hash: input.pass_hash ?? null, legacy_id: input.legacy_id ?? null
      });
    },
    async updateProfile(id, patch) {
      const rows = await updateRows<ProfileRow>("profiles", { id: eq(id) }, patch as Record<string, unknown>);
      if (!rows[0]) throw new Error("profile-not-found");
      return rows[0];
    },

    async createSession(userId, hash, expiresAt, ip, ua) {
      await insertOne<SessionRow>("auth_sessions", { user_id: userId, token_hash: hash, expires_at: new Date(expiresAt).toISOString(), ip: ip.slice(0, 64), user_agent: ua.slice(0, 160) });
    },
    async findSession(hash) { return selectOne<SessionRow>("auth_sessions", { token_hash: eq(hash) }); },
    async revokeSession(hash) { await updateRows("auth_sessions", { token_hash: eq(hash), revoked_at: NULL }, { revoked_at: nowIso() }); },
    async revokeAllSessions(userId) { await updateRows("auth_sessions", { user_id: eq(userId), revoked_at: NULL }, { revoked_at: nowIso() }); },

    async createAuthToken(userId, kind, hash, expiresAt) {
      await insertOne<AuthTokenRow>("auth_tokens", { user_id: userId, kind, token_hash: hash, expires_at: new Date(expiresAt).toISOString() });
    },
    async findAuthToken(hash, kind) { return selectOne<AuthTokenRow>("auth_tokens", { token_hash: eq(hash), kind: eq(kind) }); },
    async consumeAuthToken(id) { await updateRows("auth_tokens", { id: eq(id), used_at: NULL }, { used_at: nowIso() }); },
    async invalidateAuthTokens(userId, kind) { await updateRows("auth_tokens", { user_id: eq(userId), kind: eq(kind), used_at: NULL }, { used_at: nowIso() }); },

    async putDevMail(row) { await insertOne("audit_logs", { action: "devmail", target: row.to_email, meta: row as unknown as Record<string, unknown> }); },
    async listDevMail() { return [] as DevMailRow[]; },
    async markDevMailUsed() { /* dev inbox is local-mode only */ },
    async dropDevMail() { /* dev inbox is local-mode only */ },

    async countTracks() { return countOf("tracks", {}); },
    async countPublicTracks() { return countOf("tracks", PUBLIC); },

    async createTrack(input: NewTrack) {
      const created = input.created_at ?? nowIso();
      return insertOne<TrackRow>("tracks", {
        user_id: input.user_id, legacy_id: input.legacy_id ?? null, title: input.title,
        source: input.source, status: input.status ?? "published", visibility: "public",
        youtube_id: input.youtube_id ?? null, is_live: input.is_live ?? false, preset: input.preset ?? null,
        audio_path: input.audio_path ?? null, audio_mime: input.audio_mime ?? null, audio_bytes: input.audio_bytes ?? null,
        cover_path: input.cover_path ?? null, cover_seed: input.cover_seed, cover_palette: input.cover_palette,
        background: input.background, style_prompt: input.style_prompt, lyrics: input.lyrics,
        instrumental: input.instrumental, duration: input.duration ?? null, plays: input.plays ?? 0,
        rights_attested: true, created_at: created, published_at: input.published_at ?? created
      });
    },
    async findTrackById(id) { return selectOne<TrackRow>("tracks", { id: eq(id) }); },
    async findTrackByLegacy(l) { return selectOne<TrackRow>("tracks", { legacy_id: eq(l) }); },
    async findTrackByAudioPath(p) { return selectOne<TrackRow>("tracks", { audio_path: eq(p) }); },
    async tracksByIds(ids) {
      if (!ids.length) return [];
      return (await call("tracks", "GET", { filters: { id: inList(ids) }, limit: 2000 })) as TrackRow[];
    },
    async tracksForUsers(userIds) {
      if (!userIds.length) return [];
      return (await call("tracks", "GET", { filters: { user_id: inList(userIds) }, order: "created_at.desc", limit: 3000 })) as TrackRow[];
    },
    async listPublicTracks(limit) {
      return (await call("tracks", "GET", { filters: PUBLIC, order: ORDER.new, limit })) as TrackRow[];
    },
        async allPublicTracks(limit) {
      return (await call("tracks", "GET", { filters: PUBLIC, order: ORDER.new, limit })) as TrackRow[];
    },

    async commentsByUser(userId) {
      return (await call("comments", "GET", { filters: { user_id: eq(userId) }, order: "created_at.desc", limit: 500 })) as CommentRow[];
    },

    async commentsByIds(ids) {
      if (!ids.length) return [];
      // No deleted_at filter — moderation needs to see removed comments.
      return (await call("comments", "GET", { filters: { id: inList(ids) }, limit: 1000 })) as CommentRow[];
    },

    async anonymizeProfile(id) {
      const now = nowIso();
      await updateRows("profiles", { id: eq(id) }, {
        name: "Deleted artist", email: `deleted+${id}@invalid.local`,
        bio: "", pass_hash: null, verified: false
      });
      await updateRows("tracks", { user_id: eq(id) }, { deleted_at: now, status: "removed" });
      await updateRows("comments", { user_id: eq(id), deleted_at: NULL }, { deleted_at: now });
      await deleteRows("likes", { user_id: eq(id) });
      await deleteRows("saves", { user_id: eq(id) });
      await deleteRows("follows", { follower_id: eq(id) });
      await deleteRows("follows", { target_id: eq(id) });
      await updateRows("auth_sessions", { user_id: eq(id), revoked_at: NULL }, { revoked_at: now });
    },

    async adminTracks(q) {
      const filters: Record<string, string> = {};
      if (q.status && q.status !== "all") filters.status = eq(q.status);
      if (q.q.trim()) {
        const s = q.q.replace(/[(),"]/g, "").replace(/\s+/g, " ").trim();
        if (s) {
          const v = s.includes(" ") ? `"${s}"` : s;
          filters.search_vector = `plfts.${v}`;
        }
      }
      const orderMap: Record<string, string> = {
        new: "created_at.desc", old: "created_at.asc",
        played: "plays.desc", reported: "comment_count.desc"
      };
      const order = orderMap[q.sort] ?? orderMap.new;
      const offset = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, "base64url").toString("utf8")) || 0) : 0;

      const rowsRes = await raw("tracks", "GET", { filters, order, limit: q.limit + 1 }, undefined, undefined);
      const rowsText = await rowsRes.text();
      const rows = rowsRes.ok && rowsText ? (JSON.parse(rowsText) as TrackRow[]).slice(0, q.limit) : [];

      const countRes = await raw("tracks", "GET", { filters, limit: 1 }, undefined, "count=exact");
      const total = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0);

      const nextOffset = offset + rows.length;
      return {
        rows,
        nextCursor: nextOffset < total ? Buffer.from(String(nextOffset)).toString("base64url") : null,
        total
      };
    },

    async adminUsers(q) {
      const filters: Record<string, string> = {};
      if (q.q.trim()) {
        const s = q.q.replace(/[(),"]/g, "").replace(/\s+/g, " ").trim();
        if (s) filters.or = `(name.ilike.*${s}*,handle.ilike.*${s}*,email.ilike.*${s}*)`;
      }
      const orderMap: Record<string, string> = {
        new: "created_at.desc", old: "created_at.asc", name: "name.asc", tracks: "created_at.desc"
      };
      const order = orderMap[q.sort] ?? orderMap.new;
      const offset = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, "base64url").toString("utf8")) || 0) : 0;

      const rowsRes = await raw("profiles", "GET", { filters, order, limit: q.limit + 1 }, undefined, undefined);
      const rowsText = await rowsRes.text();
      const rows = rowsRes.ok && rowsText ? (JSON.parse(rowsText) as ProfileRow[]).slice(0, q.limit) : [];

      const countRes = await raw("profiles", "GET", { filters, limit: 1 }, undefined, "count=exact");
      const total = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0);

      const nextOffset = offset + rows.length;
      return {
        rows,
        nextCursor: nextOffset < total ? Buffer.from(String(nextOffset)).toString("base64url") : null,
        total
      };
    },
    async updateTrack(id, patch) {
      const rows = await updateRows<TrackRow>("tracks", { id: eq(id) }, patch as Record<string, unknown>);
      if (!rows[0]) throw new Error("track-not-found");
      return rows[0];
    },
    async softDeleteTrack(id) { await updateRows("tracks", { id: eq(id) }, { deleted_at: nowIso(), status: "removed" }); },
    async restoreTrack(id) { await updateRows("tracks", { id: eq(id) }, { deleted_at: null, status: "published" }); },

    async feed(query: FeedQuery): Promise<FeedPage> {
      const filters: Record<string, string> = { ...PUBLIC };
      if (query.view === "upload") filters.source = eq("upload");
      if (query.view === "youtube") filters.source = eq("youtube");

      if (query.viewerId && ["saved", "liked", "following"].includes(query.view)) {
        const table = query.view === "saved" ? "saves" : query.view === "liked" ? "likes" : "follows";
        const key = query.view === "following" ? "target_id" : "track_id";
        const who = query.view === "following" ? "follower_id" : "user_id";
        const rows = (await call(table, "GET", { select: key, filters: { [who]: eq(query.viewerId) }, limit: 5000 })) as Record<string, string>[];
        const ids = rows.map((r) => r[key]);
        if (!ids.length) return { items: [], nextCursor: null, hasMore: false };
        filters[query.view === "following" ? "user_id" : "id"] = inList(ids);
      }

      const groups: string[] = [];

      if (query.q.trim()) {
        const artists = await this.searchProfileIds(query.q, 50);
        const raw = query.q.replace(/[(),"]/g, "").replace(/\s+/g, " ").trim();
        const parts: string[] = [];
        if (raw) {
          const v = raw.includes(" ") ? `"${raw}"` : raw;
          parts.push(`search_vector.plfts.${v}`);
        }
        if (artists.length) parts.push(`user_id.${inList(artists)}`);
        if (parts.length) groups.push(`(${parts.join(",")})`);
      }

      const c = decodeCursor(query.cursor);
      if (c) {
        const col = KEYCOL[query.sort];
        const op = query.sort === "old" ? "gt" : "lt";
        groups.push(`(${col}.${op}.${quote(c.k)},and(${col}.eq.${quote(c.k)},id.${op}.${quote(c.i)}))`);
      }

      if (groups.length === 1) filters.or = groups[0];
      else if (groups.length > 1) filters.and = `(${groups.join(",")})`;

      const rows = (await call("tracks", "GET", { filters, order: ORDER[query.sort], limit: query.limit + 1 })) as TrackRow[];
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      return {
        items: await decorate(page, query.viewerId),
        nextCursor: hasMore && last ? encodeCursor(last, query.sort) : null,
        hasMore
      };
    },

    async tracksByUser(userId) {
      return (await call("tracks", "GET", { filters: { user_id: eq(userId), deleted_at: NULL }, order: "created_at.desc", limit: 500 })) as TrackRow[];
    },
    async incrementPlays(id, by) {
      try {
        const res = await fetch(`${rest()}/rpc/increment_plays`, {
          method: "POST", headers: headers(), body: JSON.stringify({ p_track_id: id, p_by: by }), cache: "no-store"
        });
        if (res.ok) {
          const t = await res.text();
          if (t) return Number(JSON.parse(t));
        }
      } catch { /* fall through */ }
      const t = await selectOne<TrackRow>("tracks", { id: eq(id) });
      if (!t) return 0;
      const next = Math.max(0, t.plays + by);
      await updateRows("tracks", { id: eq(id) }, { plays: next });
      return next;
    },

    async commentsForTracks(ids) {
      if (!ids.length) return [];
      return (await call("comments", "GET", { filters: { track_id: inList(ids), deleted_at: NULL }, order: "created_at.asc", limit: 2000 })) as CommentRow[];
    },
    async addComment(trackId, userId, body) {
      const row = await insertOne<CommentRow>("comments", { track_id: trackId, user_id: userId, body });
      await recount(trackId); return row;
    },
    async findComment(id) { return selectOne<CommentRow>("comments", { id: eq(id) }); },
    async softDeleteComment(id) {
      const c = await selectOne<CommentRow>("comments", { id: eq(id) });
      if (c) { await updateRows("comments", { id: eq(id) }, { deleted_at: nowIso() }); await recount(c.track_id); }
    },
    async restoreComment(id) {
      const c = await selectOne<CommentRow>("comments", { id: eq(id) });
      if (!c) return;
      if (!(await rpc("restore_comment", { p_comment_id: id }))) await updateRows("comments", { id: eq(id) }, { deleted_at: null });
      await recount(c.track_id);
    },

    async isLiked(u, t) { return !!(await selectOne("likes", { user_id: eq(u), track_id: eq(t) })); },
    async setLike(u, t, on) {
      const has = await this.isLiked(u, t);
      if (on && !has) await call("likes", "POST", {}, { user_id: u, track_id: t });
      if (!on && has) await deleteRows("likes", { user_id: eq(u), track_id: eq(t) });
      return recount(t);
    },
    async likedTrackIds(u) {
      return ((await call("likes", "GET", { select: "track_id", filters: { user_id: eq(u) }, limit: 5000 })) as { track_id: string }[]).map((r) => r.track_id);
    },
    async isSaved(u, t) { return !!(await selectOne("saves", { user_id: eq(u), track_id: eq(t) })); },
    async setSave(u, t, on) {
      const has = await this.isSaved(u, t);
      if (on && !has) await call("saves", "POST", {}, { user_id: u, track_id: t });
      if (!on && has) await deleteRows("saves", { user_id: eq(u), track_id: eq(t) });
    },
    async savedTrackIds(u) {
      return ((await call("saves", "GET", { select: "track_id", filters: { user_id: eq(u) }, limit: 5000 })) as { track_id: string }[]).map((r) => r.track_id);
    },
    async followingIds(u) {
      return ((await call("follows", "GET", { select: "target_id", filters: { follower_id: eq(u) }, limit: 5000 })) as { target_id: string }[]).map((r) => r.target_id);
    },
    async setFollow(f, t, on) {
      if (f === t) return;
      const has = !!(await selectOne("follows", { follower_id: eq(f), target_id: eq(t) }));
      if (on && !has) await call("follows", "POST", {}, { follower_id: f, target_id: t });
      if (!on && has) await deleteRows("follows", { follower_id: eq(f), target_id: eq(t) });
    },
    async logPlay(trackId, userId, ipHash) {
      await call("plays", "POST", {}, { track_id: trackId, user_id: userId, ip_hash: ipHash });
    },

    async saveFile(bucket, p, data, mime): Promise<StoredFile> {
      const clean = p.replace(/[^a-zA-Z0-9._/-]/g, "_");
      const res = await fetch(`${root()}/storage/v1/object/${bucket}/${clean}`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": mime, "x-upsert": "true" },
        body: new Uint8Array(data)
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`);
      return { path: clean, mime, bytes: data.byteLength };
    },
    async readFile(bucket, p) {
      const res = await fetch(`${root()}/storage/v1/object/${bucket}/${p}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store" });
      if (!res.ok) return null;
      return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "application/octet-stream" };
    },
    async signedUrl(bucket, p, ttl) {
      const res = await fetch(`${root()}/storage/v1/object/sign/${bucket}/${p}`, { method: "POST", headers: headers(), body: JSON.stringify({ expiresIn: ttl }) });
      if (!res.ok) return null;
      const j = (await res.json()) as { signedURL?: string };
      return j.signedURL ? `${root()}/storage/v1${j.signedURL}` : null;
    },

    async createSignedUploadUrl(bucket, path) {
      const res = await fetch(`${root()}/storage/v1/object/upload/sign/${bucket}/${path}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Supabase signed URL error (${res.status}): ${text}`);
        return null;
      }
      const j = (await res.json()) as { url?: string; token?: string };
      if (!j.url || !j.token) {
        console.error("Supabase signed URL: missing url or token in response", JSON.stringify(j));
        return null;
      }
      return { signedUrl: `${root()}/storage/v1${j.url}`, token: j.token };
    },

    async audit(actorId, action, target, meta, ip) {
      await call("audit_logs", "POST", {}, { actor_id: actorId, action, target, meta, ip: ip.slice(0, 64) });
    }
  };
}