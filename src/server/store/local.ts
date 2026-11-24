import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "../crypto";
import { DATA_DIR } from "../env";
import {
  encodeCursor, decodeCursor, afterCursor,
  type Repo, type ProfileRow, type SessionRow, type AuthTokenRow, type DevMailRow,
  type TrackRow, type CommentRow, type NewProfile, type NewTrack,
  type FeedQuery, type FeedPage, type FeedTrack, type StoredFile, type FeedSort
} from "./types";

interface Shape {
  meta: Record<string, Record<string, unknown>>;
  profiles: ProfileRow[];
  sessions: SessionRow[];
  tokens: AuthTokenRow[];
  devmail: DevMailRow[];
  tracks: TrackRow[];
  comments: CommentRow[];
  likes: { user_id: string; track_id: string }[];
  saves: { user_id: string; track_id: string }[];
  follows: { follower_id: string; target_id: string }[];
  audit: { id: string; actor_id: string | null; action: string; target: string; meta: Record<string, unknown>; ip: string; created_at: string }[];
}

const FILE = path.join(DATA_DIR, "ilistenai.json");
const MEDIA = path.join(DATA_DIR, "media");

let cache: Shape | null = null;
let chain: Promise<unknown> = Promise.resolve();

const empty = (): Shape => ({ meta: {}, profiles: [], sessions: [], tokens: [], devmail: [], tracks: [], comments: [], likes: [], saves: [], follows: [], audit: [] });

async function load(): Promise<Shape> {
  if (cache) return cache;
  try { cache = { ...empty(), ...(JSON.parse(await fs.readFile(FILE, "utf8")) as Shape) }; }
  catch { cache = empty(); }
  return cache!;
}

async function persist(): Promise<void> {
  const data = cache ?? empty();
  chain = chain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    await fs.rename(tmp, FILE);
  }).catch(() => undefined);
  await chain;
}

const nowIso = () => new Date().toISOString();
const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const safeName = (p: string) => p.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\.\./g, "_");
const isPublic = (t: TrackRow) => t.status === "published" && t.visibility === "public" && !t.deleted_at;

function sorter(sort: FeedSort) {
  const asc = sort === "old";
  const key = (t: TrackRow) => sort === "liked" ? t.like_count : sort === "played" ? t.plays : t.created_at;
  return (a: TrackRow, b: TrackRow) => {
    const ka = key(a), kb = key(b);
    if (ka !== kb) {
      if (typeof ka === "number" && typeof kb === "number") return asc ? ka - kb : kb - ka;
      return asc ? String(ka).localeCompare(String(kb)) : String(kb).localeCompare(String(ka));
    }
    return asc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  };
}

export function createLocalRepo(): Repo {
  const decorate = (db: Shape, rows: TrackRow[], viewerId: string | null): FeedTrack[] => {
    const liked = new Set(viewerId ? db.likes.filter((l) => l.user_id === viewerId).map((l) => l.track_id) : []);
    const saved = new Set(viewerId ? db.saves.filter((s) => s.user_id === viewerId).map((s) => s.track_id) : []);
    return rows.map((t) => ({
      track: clone(t),
      likedByMe: liked.has(t.id),
      savedByMe: saved.has(t.id),
      comments: clone(db.comments.filter((c) => c.track_id === t.id && !c.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-50))
    }));
  };

  const recount = (db: Shape, trackId: string) => {
    const t = db.tracks.find((x) => x.id === trackId);
    if (!t) return;
    t.like_count = db.likes.filter((l) => l.track_id === trackId).length;
    t.comment_count = db.comments.filter((c) => c.track_id === trackId && !c.deleted_at).length;
  };

  return {
    async getMeta(key) { return clone((await load()).meta[key] ?? null); },
    async setMeta(key, value) {
      const db = await load();
      db.meta[key] = value; await persist();
    },

    async listProfiles() { return clone((await load()).profiles); },
    async profilesByIds(ids) {
      const set = new Set(ids);
      return clone((await load()).profiles.filter((p) => set.has(p.id)));
    },
    async findProfileByEmail(e) { return clone((await load()).profiles.find((p) => p.email === e.toLowerCase()) ?? null); },
    async findProfileById(id) { return clone((await load()).profiles.find((p) => p.id === id) ?? null); },
    async findProfileByLegacy(l) { return clone((await load()).profiles.find((p) => p.legacy_id === l) ?? null); },
    async findProfileByHandle(h) { return clone((await load()).profiles.find((p) => p.handle === h.toLowerCase()) ?? null); },
    async searchProfileIds(q, limit) {
      const n = q.toLowerCase();
      return (await load()).profiles.filter((p) => p.name.toLowerCase().includes(n) || p.handle.toLowerCase().includes(n)).slice(0, limit).map((p) => p.id);
    },
    async handleTaken(h) { return (await load()).profiles.some((p) => p.handle === h.toLowerCase()); },
    async createProfile(input: NewProfile) {
      const db = await load();
      const row: ProfileRow = {
        id: uuid(), legacy_id: input.legacy_id ?? null, email: input.email.toLowerCase(),
        name: input.name, handle: input.handle.toLowerCase(), bio: input.bio ?? "",
        avatar_palette: input.avatar_palette ?? 0, provider: input.provider ?? "email",
        role: input.role ?? "creator", verified: input.verified ?? false,
        pass_hash: input.pass_hash ?? null, created_at: nowIso()
      };
      db.profiles.push(row); await persist(); return clone(row);
    },
    async updateProfile(id, patch) {
      const db = await load();
      const i = db.profiles.findIndex((p) => p.id === id);
      if (i < 0) throw new Error("profile-not-found");
      db.profiles[i] = { ...db.profiles[i], ...patch };
      await persist(); return clone(db.profiles[i]);
    },

    async createSession(userId, hash, expiresAt, ip, ua) {
      const db = await load();
      db.sessions.push({ id: uuid(), user_id: userId, token_hash: hash, expires_at: new Date(expiresAt).toISOString(), revoked_at: null });
      if (db.sessions.length > 500) db.sessions = db.sessions.slice(-500);
      await persist();
      void ip; void ua;
    },
    async findSession(hash) { return clone((await load()).sessions.find((s) => s.token_hash === hash) ?? null); },
    async revokeSession(hash) {
      const db = await load();
      const s = db.sessions.find((x) => x.token_hash === hash);
      if (s && !s.revoked_at) { s.revoked_at = nowIso(); await persist(); }
    },
    async revokeAllSessions(userId) {
      const db = await load(); let dirty = false;
      for (const s of db.sessions) if (s.user_id === userId && !s.revoked_at) { s.revoked_at = nowIso(); dirty = true; }
      if (dirty) await persist();
    },

    async createAuthToken(userId, kind, hash, expiresAt) {
      const db = await load();
      db.tokens.push({ id: uuid(), user_id: userId, kind, token_hash: hash, expires_at: new Date(expiresAt).toISOString(), used_at: null });
      if (db.tokens.length > 500) db.tokens = db.tokens.slice(-500);
      await persist();
    },
    async findAuthToken(hash, kind) { return clone((await load()).tokens.find((t) => t.token_hash === hash && t.kind === kind) ?? null); },
    async consumeAuthToken(id) {
      const db = await load();
      const t = db.tokens.find((x) => x.id === id);
      if (t && !t.used_at) { t.used_at = nowIso(); await persist(); }
    },
    async invalidateAuthTokens(userId, kind) {
      const db = await load(); let dirty = false;
      for (const t of db.tokens) if (t.user_id === userId && t.kind === kind && !t.used_at) { t.used_at = nowIso(); dirty = true; }
      if (dirty) await persist();
    },

    async putDevMail(row) {
      const db = await load();
      db.devmail.push({ ...row, id: uuid() });
      if (db.devmail.length > 200) db.devmail = db.devmail.slice(-200);
      await persist();
    },
    async listDevMail(boxId) {
      return clone((await load()).devmail.filter((m) => m.box_id === boxId).sort((a, b) => b.sent_at.localeCompare(a.sent_at)).slice(0, 10));
    },
    async markDevMailUsed(token) {
      const db = await load();
      const m = db.devmail.find((x) => x.token === token);
      if (m && !m.used_at) { m.used_at = nowIso(); await persist(); }
    },
    async dropDevMail(boxId, kind) {
      const db = await load(); let dirty = false;
      for (const m of db.devmail) if (m.box_id === boxId && m.kind === kind && !m.used_at) { m.used_at = nowIso(); dirty = true; }
      if (dirty) await persist();
    },

    async countTracks() { return (await load()).tracks.length; },
    async countPublicTracks() { return (await load()).tracks.filter(isPublic).length; },

    async createTrack(input: NewTrack) {
      const db = await load();
      const created = input.created_at ?? nowIso();
      const row: TrackRow = {
        id: uuid(), legacy_id: input.legacy_id ?? null, user_id: input.user_id,
        title: input.title, source: input.source, status: input.status ?? "published",
        visibility: "public", youtube_id: input.youtube_id ?? null, is_live: input.is_live ?? false,
        preset: input.preset ?? null, audio_path: input.audio_path ?? null,
        audio_mime: input.audio_mime ?? null, audio_bytes: input.audio_bytes ?? null,
        cover_path: input.cover_path ?? null, cover_seed: input.cover_seed,
        cover_palette: input.cover_palette, background: input.background,
        style_prompt: input.style_prompt, lyrics: input.lyrics, instrumental: input.instrumental,
        license: "all_rights_reserved", ai_tool: null, human_contribution: null,
        explicit: false, rights_attested: true,
        duration: input.duration ?? null, plays: input.plays ?? 0, like_count: 0, comment_count: 0,
        created_at: created, updated_at: created, published_at: input.published_at ?? created, deleted_at: null
      };
      db.tracks.push(row); await persist(); return clone(row);
    },
    async findTrackById(id) { return clone((await load()).tracks.find((t) => t.id === id) ?? null); },
    async findTrackByLegacy(l) { return clone((await load()).tracks.find((t) => t.legacy_id === l) ?? null); },
    async findTrackByAudioPath(p) { return clone((await load()).tracks.find((t) => t.audio_path === p) ?? null); },
    async tracksByIds(ids) {
      const set = new Set(ids);
      return clone((await load()).tracks.filter((t) => set.has(t.id)));
    },
    async tracksForUsers(userIds) {
      const set = new Set(userIds);
      return clone((await load()).tracks.filter((t) => set.has(t.user_id)));
    },
    async listPublicTracks(limit) {
      return clone((await load()).tracks.filter(isPublic).sort(sorter("new")).slice(0, limit));
    },
    async updateTrack(id, patch) {
      const db = await load();
      const i = db.tracks.findIndex((t) => t.id === id);
      if (i < 0) throw new Error("track-not-found");
      db.tracks[i] = { ...db.tracks[i], ...patch, updated_at: nowIso() };
      await persist(); return clone(db.tracks[i]);
    },
    async softDeleteTrack(id) {
      const db = await load();
      const t = db.tracks.find((x) => x.id === id);
      if (t) { t.deleted_at = nowIso(); t.status = "removed"; await persist(); }
    },
    async restoreTrack(id) {
      const db = await load();
      const t = db.tracks.find((x) => x.id === id);
      if (t) { t.deleted_at = null; t.status = "published"; await persist(); }
    },

    async feed(query: FeedQuery): Promise<FeedPage> {
      const db = await load();
      let list = db.tracks.filter(isPublic);
      if (query.view === "upload") list = list.filter((t) => t.source === "upload");
      if (query.view === "youtube") list = list.filter((t) => t.source === "youtube");
      if (query.viewerId && ["saved", "liked", "following"].includes(query.view)) {
        const ids = query.view === "saved"
          ? new Set(db.saves.filter((s) => s.user_id === query.viewerId).map((s) => s.track_id))
          : query.view === "liked"
            ? new Set(db.likes.filter((l) => l.user_id === query.viewerId).map((l) => l.track_id))
            : new Set(db.follows.filter((f) => f.follower_id === query.viewerId).map((f) => f.target_id));
        list = query.view === "following" ? list.filter((t) => ids.has(t.user_id)) : list.filter((t) => ids.has(t.id));
      }
      if (query.q) {
        const n = query.q.toLowerCase();
        const artists = new Set(db.profiles.filter((p) => p.name.toLowerCase().includes(n) || p.handle.toLowerCase().includes(n)).map((p) => p.id));
        list = list.filter((t) =>
          t.title.toLowerCase().includes(n) || t.style_prompt.toLowerCase().includes(n)
          || t.background.toLowerCase().includes(n) || t.lyrics.toLowerCase().includes(n)
          || artists.has(t.user_id));
      }
      list = [...list].sort(sorter(query.sort));
      const c = decodeCursor(query.cursor);
      if (c) list = list.filter((t) => afterCursor(t, query.sort, c));
      const slice = list.slice(0, query.limit + 1);
      const hasMore = slice.length > query.limit;
      const rows = hasMore ? slice.slice(0, query.limit) : slice;
      const last = rows[rows.length - 1];
      return {
        items: decorate(db, rows, query.viewerId),
        nextCursor: hasMore && last ? encodeCursor(last, query.sort) : null,
        hasMore
      };
    },

    async tracksByUser(userId) {
      return clone((await load()).tracks.filter((t) => t.user_id === userId && !t.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
        async allPublicTracks(limit) {
      return clone((await load()).tracks.filter((t) => t.status === "published" && t.visibility === "public" && !t.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit));
    },

    async commentsByUser(userId) {
      return clone((await load()).comments.filter((c) => c.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },

    async commentsByIds(ids) {
      const set = new Set(ids);
      return clone((await load()).comments.filter((c) => set.has(c.id)));  // no deleted_at filter
    },

    async anonymizeProfile(id) {
      const db = await load();
      const p = db.profiles.find((x) => x.id === id);
      if (!p) return;
      p.name = "Deleted artist";
      p.email = `deleted+${id}@invalid.local`;
      p.bio = ""; p.pass_hash = null; p.verified = false;
      for (const t of db.tracks.filter((t) => t.user_id === id)) { t.deleted_at = nowIso(); t.status = "removed"; }
      for (const c of db.comments.filter((c) => c.user_id === id)) c.deleted_at = nowIso();
      db.likes = db.likes.filter((l) => l.user_id !== id);
      db.saves = db.saves.filter((s) => s.user_id !== id);
      db.follows = db.follows.filter((f) => f.follower_id !== id && f.target_id !== id);
      for (const s of db.sessions.filter((s) => s.user_id === id)) s.revoked_at = nowIso();
      for (const t of db.tracks) recount(db, t.id);
      await persist();
    },

    async adminTracks(q) {
      const db = await load();
      let list = db.tracks.slice();
      if (q.status && q.status !== "all") list = list.filter((t) => t.status === q.status);
      if (q.q.trim()) {
        const n = q.q.toLowerCase();
        const names = new Map(db.profiles.map((p) => [p.id, `${p.name} ${p.handle}`.toLowerCase()]));
        list = list.filter((t) => t.title.toLowerCase().includes(n) || (names.get(t.user_id) ?? "").includes(n));
      }
      const sortFn: Record<string, (a: TrackRow, b: TrackRow) => number> = {
        new: (a, b) => b.created_at.localeCompare(a.created_at),
        old: (a, b) => a.created_at.localeCompare(b.created_at),
        played: (a, b) => b.plays - a.plays,
        reported: (a, b) => b.comment_count - a.comment_count
      };
      list.sort(sortFn[q.sort] ?? sortFn.new);
      const offset = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, "base64url").toString("utf8")) || 0) : 0;
      const slice = list.slice(offset, offset + q.limit);
      const next = offset + slice.length;
      return { rows: clone(slice), nextCursor: next < list.length ? Buffer.from(String(next)).toString("base64url") : null, total: list.length };
    },

    async adminUsers(q) {
      const db = await load();
      let list = db.profiles.slice();
      if (q.q.trim()) {
        const n = q.q.toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(n) || p.handle.toLowerCase().includes(n) || p.email.toLowerCase().includes(n));
      }
      const count = (id: string) => db.tracks.filter((t) => t.user_id === id).length;
      const sortFn: Record<string, (a: ProfileRow, b: ProfileRow) => number> = {
        new: (a, b) => b.created_at.localeCompare(a.created_at),
        old: (a, b) => a.created_at.localeCompare(b.created_at),
        tracks: (a, b) => count(b.id) - count(a.id),
        name: (a, b) => a.name.localeCompare(b.name)
      };
      list.sort(sortFn[q.sort] ?? sortFn.new);
      const offset = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, "base64url").toString("utf8")) || 0) : 0;
      const slice = list.slice(offset, offset + q.limit);
      const next = offset + slice.length;
      return { rows: clone(slice), nextCursor: next < list.length ? Buffer.from(String(next)).toString("base64url") : null, total: list.length };
    },
    async incrementPlays(id, by) {
      const db = await load();
      const t = db.tracks.find((x) => x.id === id);
      if (!t) return 0;
      t.plays = Math.max(0, t.plays + by);
      await persist();
      return t.plays;
    },

    async commentsForTracks(ids) {
      const set = new Set(ids);
      return clone((await load()).comments.filter((c) => set.has(c.track_id) && !c.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    },
    async addComment(trackId, userId, body) {
      const db = await load();
      const row: CommentRow = { id: uuid(), track_id: trackId, user_id: userId, body, created_at: nowIso(), deleted_at: null };
      db.comments.push(row); recount(db, trackId); await persist(); return clone(row);
    },
    async findComment(id) { return clone((await load()).comments.find((c) => c.id === id) ?? null); },
    async softDeleteComment(id) {
      const db = await load();
      const c = db.comments.find((x) => x.id === id);
      if (c) { c.deleted_at = nowIso(); recount(db, c.track_id); await persist(); }
    },
    async restoreComment(id) {
      const db = await load();
      const c = db.comments.find((x) => x.id === id);
      if (c) { c.deleted_at = null; recount(db, c.track_id); await persist(); }
    },

    async isLiked(u, t) { return (await load()).likes.some((l) => l.user_id === u && l.track_id === t); },
    async setLike(u, t, on) {
      const db = await load();
      const has = db.likes.some((l) => l.user_id === u && l.track_id === t);
      if (on && !has) db.likes.push({ user_id: u, track_id: t });
      if (!on && has) db.likes = db.likes.filter((l) => !(l.user_id === u && l.track_id === t));
      recount(db, t); await persist();
      return db.tracks.find((x) => x.id === t)?.like_count ?? 0;
    },
    async likedTrackIds(u) { return (await load()).likes.filter((l) => l.user_id === u).map((l) => l.track_id); },
    async isSaved(u, t) { return (await load()).saves.some((l) => l.user_id === u && l.track_id === t); },
    async setSave(u, t, on) {
      const db = await load();
      const has = db.saves.some((l) => l.user_id === u && l.track_id === t);
      if (on && !has) db.saves.push({ user_id: u, track_id: t });
      if (!on && has) db.saves = db.saves.filter((l) => !(l.user_id === u && l.track_id === t));
      await persist();
    },
    async savedTrackIds(u) { return (await load()).saves.filter((l) => l.user_id === u).map((l) => l.track_id); },
    async followingIds(u) { return (await load()).follows.filter((f) => f.follower_id === u).map((f) => f.target_id); },
    async setFollow(f, t, on) {
      const db = await load();
      const has = db.follows.some((x) => x.follower_id === f && x.target_id === t);
      if (on && !has && f !== t) db.follows.push({ follower_id: f, target_id: t });
      if (!on && has) db.follows = db.follows.filter((x) => !(x.follower_id === f && x.target_id === t));
      await persist();
    },
    async logPlay(trackId) {
      const db = await load();
      const t = db.tracks.find((x) => x.id === trackId);
      if (t) { t.plays += 1; await persist(); }
    },

    async saveFile(bucket, p, data, mime): Promise<StoredFile> {
      const abs = path.join(MEDIA, bucket, safeName(p));
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, data);
      return { path: safeName(p), mime, bytes: data.byteLength };
    },
    async readFile(bucket, p) {
      try {
        const abs = path.join(MEDIA, bucket, safeName(p));
        const data = await fs.readFile(abs);
        const ext = path.extname(abs).toLowerCase();
        const mime = ext === ".wav" ? "audio/wav" : ext === ".ogg" ? "audio/ogg" : ext === ".flac" ? "audio/flac"
          : ext === ".m4a" ? "audio/mp4" : ext === ".webm" ? "audio/webm" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
            : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".avif" ? "image/avif"
              : ext === ".gif" ? "image/gif" : "audio/mpeg";
        return { data, mime };
      } catch { return null; }
    },
    async signedUrl() { return null; },

    async audit(actorId, action, target, meta, ip) {
      const db = await load();
      db.audit.push({ id: uuid(), actor_id: actorId, action, target, meta, ip, created_at: nowIso() });
      if (db.audit.length > 1500) db.audit = db.audit.slice(-1500);
      await persist();
    }
  };
}