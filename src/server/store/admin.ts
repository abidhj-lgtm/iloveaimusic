import "server-only";
import { SUPABASE_URL, SUPABASE_KEY } from "../env";
import { reportError } from "../observability";

/* ---------------- transport ---------------- */

const rest = () => `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
const H = (extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  ...extra
});
const eq = (v: string) => `eq.${v}`;
const NULL = "is.null";

interface QOpts { select?: string; filters?: Record<string, string>; order?: string; limit?: number; offset?: number }

function q(table: string, o: QOpts = {}) {
  const p = new URLSearchParams();
  p.set("select", o.select ?? "*");
  for (const [k, v] of Object.entries(o.filters ?? {})) p.set(k, v);
  if (o.order) p.set("order", o.order);
  if (o.limit !== undefined) p.set("limit", String(o.limit));
  if (o.offset !== undefined) p.set("offset", String(o.offset));
  return `${rest()}/${table}?${p.toString()}`;
}

async function req(
  table: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  o: QOpts = {},
  body?: unknown,
  prefer?: string
): Promise<any[]> {
  const res = await fetch(q(table, o), {
    method,
    headers: H(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j?.message ?? j?.hint ?? text; } catch { /* raw */ }
    const err = new Error(`admin ${table} ${method} (${res.status}): ${detail}`);
    reportError(err, { route: `admin:${table}`, status: res.status });
    throw err;
  }
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/* ---------------- types ---------------- */

export type Role = "user" | "moderator" | "admin";

export interface Creator {
  id: string;
  publicId: string;
  name: string;
  handle: string;
  email: string;
  verified: boolean;
  provider: string;
  bio: string;
  avatarPalette: number;
  role: Role;
  isOfficial: boolean;
  suspended: boolean;
  suspendedAt: string | null;
  createdAt: number;
  stats: { tracks: number; live: number; hidden: number; deleted: number; plays: number; likes: number; comments: number };
}

export interface AdminTrack {
  id: string;
  publicId: string;
  title: string;
  userId: string;
  artistName: string;
  artistHandle: string;
  artistPalette: number;
  source: "upload" | "youtube" | "synth";
  youtubeId: string | null;
  coverSeed: string;
  coverPalette: number;
  stylePrompt: string;
  background: string;
  instrumental: boolean;
  duration: number | null;
  plays: number;
  likes: number;
  comments: number;
  state: "live" | "hidden" | "deleted";
  visibility: string;
  status: string;
  createdAt: number;
  updatedAt: number | null;
}

export interface Overview {
  totals: {
    creators: number; admins: number; official: number; suspended: number; unverified: number;
    tracks: number; live: number; hidden: number; deleted: number;
    plays: number; likes: number; comments: number;
    playsToday: number; creatorsToday: number; tracksToday: number;
  };
  series: { day: string; signups: number; uploads: number }[];
  sources: { key: string; label: string; count: number }[];
  topCreators: Creator[];
  recentTracks: AdminTrack[];
  reports: { pending: number; total: number };
}

export interface Page<T> { items: T[]; total: number; page: number; perPage: number; hasMore: boolean }

/* ---------------- normalisers ---------------- */

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const ts = (v: unknown) => {
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function normProfile(r: any): Omit<Creator, "stats"> {
  const role = String(r?.role ?? "user");
  return {
    id: String(r?.id ?? ""),
    publicId: String(r?.legacy_id ?? r?.id ?? ""),
    name: String(r?.name ?? "Unnamed"),
    handle: String(r?.handle ?? "unknown"),
    email: String(r?.email ?? ""),
    verified: !!r?.verified,
    provider: String(r?.provider ?? "email"),
    bio: String(r?.bio ?? ""),
    avatarPalette: num(r?.avatar_palette),
    role: (role === "admin" || role === "moderator" ? role : "user") as Role,
    isOfficial: !!r?.is_official,
    suspended: !!r?.suspended_at,
    suspendedAt: r?.suspended_at ?? null,
    createdAt: ts(r?.created_at)
  };
}

function sourceOf(r: any): "upload" | "youtube" | "synth" {
  if (String(r?.source ?? "") === "youtube") return "youtube";
  if (r?.preset) return "synth";
  return "upload";
}

function stateOf(r: any): "live" | "hidden" | "deleted" {
  if (r?.deleted_at) return "deleted";
  if (String(r?.visibility ?? "public") !== "public" || String(r?.status ?? "published") !== "published") return "hidden";
  return "live";
}

/* ---------------- snapshot (5s memo, one round-trip per table) ---------------- */

interface Snap { profiles: any[]; tracks: any[]; comments: any[]; at: number }
let snap: Snap | null = null;
let inflight: Promise<Snap> | null = null;

async function loadSnap(force = false): Promise<Snap> {
  if (!force && snap && Date.now() - snap.at < 5000) return snap;
  if (!force && inflight) return inflight;

  const run = (async () => {
    const [profiles, tracks] = await Promise.all([
      req("profiles", "GET", { order: "created_at.desc", limit: 3000 }),
      req("tracks", "GET", { order: "created_at.desc", limit: 6000 })
    ]);
    let comments: any[] = [];
    try {
      comments = await req("comments", "GET", { select: "id,track_id,user_id,created_at", limit: 6000 });
    } catch { /* comments table optional — degrade to zero counts */ }
    const next: Snap = { profiles, tracks, comments, at: Date.now() };
    snap = next;
    inflight = null;
    return next;
  })();

  inflight = run;
  return run;
}

export function invalidateAdminCache() { snap = null; }

/* ---------------- auth guard ---------------- */

export async function adminIdentity(sessionId: string | null): Promise<{ profile: Creator | null; role: Role | null }> {
  if (!sessionId) return { profile: null, role: null };
  let row: any = null;
  try { row = (await req("profiles", "GET", { filters: { id: eq(sessionId) }, limit: 1 }))[0] ?? null; } catch { /* not a uuid */ }
  if (!row) {
    try { row = (await req("profiles", "GET", { filters: { legacy_id: eq(sessionId) }, limit: 1 }))[0] ?? null; } catch { /* ignore */ }
  }
  if (!row) return { profile: null, role: null };
  const base = normProfile(row);
  const role = base.role;
  if (role !== "admin" && role !== "moderator") return { profile: null, role };
  const s = await loadSnap().catch(() => null);
  const stats = s ? statsFor(s, base.id) : emptyStats();
  return { profile: { ...base, stats }, role };
}

/* ---------------- aggregation ---------------- */

function emptyStats() {
  return { tracks: 0, live: 0, hidden: 0, deleted: 0, plays: 0, likes: 0, comments: 0 };
}

function commentMap(s: Snap) {
  const m = new Map<string, number>();
  for (const c of s.comments) {
    const k = String(c?.track_id ?? "");
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function statsFor(s: Snap, profileId: string) {
  const out = emptyStats();
  const cm = commentMap(s);
  for (const t of s.tracks) {
    if (String(t?.user_id ?? "") !== profileId) continue;
    const st = stateOf(t);
    out.tracks++;
    if (st === "deleted") { out.deleted++; continue; }
    if (st === "hidden") out.hidden++; else out.live++;
    out.plays += num(t?.plays);
    out.likes += num(t?.like_count);
    out.comments += cm.get(String(t?.id ?? "")) ?? num(t?.comment_count);
  }
  return out;
}

function buildCreators(s: Snap): Creator[] {
  const cm = commentMap(s);
  const byUser = new Map<string, ReturnType<typeof emptyStats>>();
  for (const t of s.tracks) {
    const uid = String(t?.user_id ?? "");
    if (!uid) continue;
    const acc = byUser.get(uid) ?? emptyStats();
    const st = stateOf(t);
    acc.tracks++;
    if (st === "deleted") acc.deleted++;
    else {
      if (st === "hidden") acc.hidden++; else acc.live++;
      acc.plays += num(t?.plays);
      acc.likes += num(t?.like_count);
      acc.comments += cm.get(String(t?.id ?? "")) ?? num(t?.comment_count);
    }
    byUser.set(uid, acc);
  }
  return s.profiles.map((p) => {
    const base = normProfile(p);
    return { ...base, stats: byUser.get(base.id) ?? emptyStats() };
  });
}

function buildTracks(s: Snap): AdminTrack[] {
  const cm = commentMap(s);
  const people = new Map(s.profiles.map((p) => [String(p?.id ?? ""), p]));
  return s.tracks.map((t) => {
    const owner = people.get(String(t?.user_id ?? ""));
    return {
      id: String(t?.id ?? ""),
      publicId: String(t?.legacy_id ?? t?.id ?? ""),
      title: String(t?.title ?? "Untitled"),
      userId: String(t?.user_id ?? ""),
      artistName: String(owner?.name ?? "Unknown artist"),
      artistHandle: String(owner?.handle ?? "unknown"),
      artistPalette: num(owner?.avatar_palette),
      source: sourceOf(t),
      youtubeId: t?.youtube_id ?? null,
      coverSeed: String(t?.cover_seed ?? t?.id ?? "seed"),
      coverPalette: num(t?.cover_palette),
      stylePrompt: String(t?.style_prompt ?? ""),
      background: String(t?.background ?? ""),
      instrumental: !!t?.instrumental,
      duration: t?.duration == null ? null : num(t?.duration),
      plays: num(t?.plays),
      likes: num(t?.like_count),
      comments: cm.get(String(t?.id ?? "")) ?? num(t?.comment_count),
      state: stateOf(t),
      visibility: String(t?.visibility ?? "public"),
      status: String(t?.status ?? "published"),
      createdAt: ts(t?.created_at),
      updatedAt: t?.updated_at ? ts(t?.updated_at) : null
    } as AdminTrack;
  });
}

/* ---------------- queries ---------------- */

export type CreatorSort = "plays" | "tracks" | "likes" | "newest" | "oldest" | "name";
export type CreatorFilter = "all" | "active" | "empty" | "staff" | "official" | "suspended" | "unverified";

export async function listCreators(opts: {
  search?: string; filter?: CreatorFilter; sort?: CreatorSort; page?: number; perPage?: number;
}): Promise<Page<Creator>> {
  const s = await loadSnap();
  let rows = buildCreators(s);

  const needle = (opts.search ?? "").trim().toLowerCase();
  if (needle) {
    rows = rows.filter((c) =>
      c.name.toLowerCase().includes(needle) ||
      c.handle.toLowerCase().includes(needle) ||
      c.email.toLowerCase().includes(needle)
    );
  }

  switch (opts.filter ?? "all") {
    case "active": rows = rows.filter((c) => c.stats.live > 0); break;
    case "empty": rows = rows.filter((c) => c.stats.tracks === 0); break;
    case "staff": rows = rows.filter((c) => c.role !== "user"); break;
    case "official": rows = rows.filter((c) => c.isOfficial); break;
    case "suspended": rows = rows.filter((c) => c.suspended); break;
    case "unverified": rows = rows.filter((c) => !c.verified); break;
  }

  const sort = opts.sort ?? "plays";
  rows.sort((a, b) => {
    switch (sort) {
      case "tracks": return b.stats.tracks - a.stats.tracks || b.stats.plays - a.stats.plays;
      case "likes": return b.stats.likes - a.stats.likes || b.stats.plays - a.stats.plays;
      case "name": return a.name.localeCompare(b.name);
      case "oldest": return a.createdAt - b.createdAt;
      case "newest": return b.createdAt - a.createdAt;
      default: return b.stats.plays - a.stats.plays || b.stats.tracks - a.stats.tracks;
    }
  });

  return paginate(rows, opts.page, opts.perPage);
}

export async function creatorDetail(id: string): Promise<{ creator: Creator; tracks: AdminTrack[] } | null> {
  const s = await loadSnap();
  const row = s.profiles.find((p) => String(p?.id ?? "") === id || String(p?.legacy_id ?? "") === id);
  if (!row) return null;
  const base = normProfile(row);
  const creator: Creator = { ...base, stats: statsFor(s, base.id) };
  const tracks = buildTracks(s)
    .filter((t) => t.userId === base.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  return { creator, tracks };
}

export type TrackSort = "newest" | "oldest" | "plays" | "likes" | "comments" | "title";
export type TrackFilter = "all" | "live" | "hidden" | "deleted";
export type SourceFilter = "all" | "upload" | "youtube" | "synth";

export async function listTracks(opts: {
  search?: string; filter?: TrackFilter; source?: SourceFilter; sort?: TrackSort;
  page?: number; perPage?: number; userId?: string;
}): Promise<Page<AdminTrack>> {
  const s = await loadSnap();
  let rows = buildTracks(s);

  if (opts.userId) {
    const owner = s.profiles.find((p) => String(p?.id ?? "") === opts.userId || String(p?.legacy_id ?? "") === opts.userId);
    const uid = owner ? String(owner.id) : opts.userId;
    rows = rows.filter((t) => t.userId === uid);
  }

  const needle = (opts.search ?? "").trim().toLowerCase();
  if (needle) {
    rows = rows.filter((t) =>
      t.title.toLowerCase().includes(needle) ||
      t.artistName.toLowerCase().includes(needle) ||
      t.artistHandle.toLowerCase().includes(needle) ||
      t.stylePrompt.toLowerCase().includes(needle)
    );
  }

  const f = opts.filter ?? "all";
  if (f !== "all") rows = rows.filter((t) => t.state === f);
  const src = opts.source ?? "all";
  if (src !== "all") rows = rows.filter((t) => t.source === src);

  const sort = opts.sort ?? "newest";
  rows.sort((a, b) => {
    switch (sort) {
      case "oldest": return a.createdAt - b.createdAt;
      case "plays": return b.plays - a.plays;
      case "likes": return b.likes - a.likes;
      case "comments": return b.comments - a.comments;
      case "title": return a.title.localeCompare(b.title);
      default: return b.createdAt - a.createdAt;
    }
  });

  return paginate(rows, opts.page, opts.perPage);
}

function paginate<T>(rows: T[], page = 1, perPage = 25): Page<T> {
  const pp = Math.min(100, Math.max(5, perPage));
  const p = Math.max(1, page);
  const total = rows.length;
  const start = (p - 1) * pp;
  const items = rows.slice(start, start + pp);
  return { items, total, page: p, perPage: pp, hasMore: start + pp < total };
}

export async function platformOverview(): Promise<Overview> {
  const s = await loadSnap();
  const creators = buildCreators(s);
  const tracks = buildTracks(s);

  const today = dayKey(Date.now());
  const days: { day: string; signups: number; uploads: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const ms = Date.now() - i * 86_400_000;
    days.push({ day: dayKey(ms), signups: 0, uploads: 0 });
  }
  const idx = new Map(days.map((d, i) => [d.day, i]));
  for (const c of creators) {
    const k = dayKey(c.createdAt);
    const i = idx.get(k);
    if (i !== undefined) days[i].signups++;
  }
  for (const t of tracks) {
    const k = dayKey(t.createdAt);
    const i = idx.get(k);
    if (i !== undefined) days[i].uploads++;
  }

  const live = tracks.filter((t) => t.state === "live");
  const sources = [
    { key: "upload", label: "Uploads", count: tracks.filter((t) => t.source === "upload").length },
    { key: "synth", label: "Synthesized", count: tracks.filter((t) => t.source === "synth").length },
    { key: "youtube", label: "YouTube", count: tracks.filter((t) => t.source === "youtube").length }
  ];

  let reports = { pending: 0, total: 0 };
  try {
    const rows = await req("reports", "GET", { select: "id,status", limit: 2000 });
    reports = {
      total: rows.length,
      pending: rows.filter((r) => String(r?.status ?? "open") === "open" || String(r?.status ?? "") === "pending").length
    };
  } catch { /* reports optional */ }

  return {
    totals: {
      creators: creators.length,
      admins: creators.filter((c) => c.role !== "user").length,
      official: creators.filter((c) => c.isOfficial).length,
      suspended: creators.filter((c) => c.suspended).length,
      unverified: creators.filter((c) => !c.verified).length,
      tracks: tracks.length,
      live: live.length,
      hidden: tracks.filter((t) => t.state === "hidden").length,
      deleted: tracks.filter((t) => t.state === "deleted").length,
      plays: live.reduce((a, t) => a + t.plays, 0),
      likes: live.reduce((a, t) => a + t.likes, 0),
      comments: tracks.reduce((a, t) => a + t.comments, 0),
      playsToday: 0,
      creatorsToday: creators.filter((c) => dayKey(c.createdAt) === today).length,
      tracksToday: tracks.filter((t) => dayKey(t.createdAt) === today).length
    },
    series: days,
    sources,
    topCreators: [...creators].sort((a, b) => b.stats.plays - a.stats.plays).slice(0, 6),
    recentTracks: [...tracks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    reports
  };
}

/* ---------------- mutations ---------------- */

const CREATOR_PATCH = new Set(["role", "is_official", "suspended_at", "verified"]);
const TRACK_PATCH = new Set(["visibility", "status", "deleted_at"]);

export async function patchCreator(id: string, patch: Record<string, unknown>): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (CREATOR_PATCH.has(k)) clean[k] = v;
  if (!Object.keys(clean).length) throw new Error("no-allowed-fields");
  await req("profiles", "PATCH", { filters: { id: eq(id) } }, clean, "return=minimal");
  invalidateAdminCache();
}

export async function patchTrack(id: string, patch: Record<string, unknown>): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (TRACK_PATCH.has(k)) clean[k] = v;
  if (!Object.keys(clean).length) throw new Error("no-allowed-fields");
  await req("tracks", "PATCH", { filters: { id: eq(id) } }, clean, "return=minimal");
  invalidateAdminCache();
}

export async function bulkPatchTracks(ids: string[], patch: Record<string, unknown>): Promise<number> {
  if (!ids.length) return 0;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (TRACK_PATCH.has(k)) clean[k] = v;
  if (!Object.keys(clean).length) throw new Error("no-allowed-fields");
  const list = `in.(${ids.map((i) => `"${i}"`).join(",")})`;
  await req("tracks", "PATCH", { filters: { id: list } }, clean, "return=minimal");
  invalidateAdminCache();
  return ids.length;
}

export async function recentActivity(limit = 12): Promise<{ kind: string; label: string; at: number; href: string }[]> {
  const s = await loadSnap();
  const people = new Map(s.profiles.map((p) => [String(p?.id ?? ""), p]));
  const out: { kind: string; label: string; at: number; href: string }[] = [];

  for (const c of s.profiles.slice(0, 40)) {
    out.push({
      kind: "signup",
      label: `${c?.name ?? "Someone"} joined as @${c?.handle ?? "unknown"}`,
      at: ts(c?.created_at),
      href: `/profile/${c?.handle ?? ""}`
    });
  }
  for (const t of s.tracks.slice(0, 40)) {
    const owner = people.get(String(t?.user_id ?? ""));
    out.push({
      kind: "upload",
      label: `${owner?.name ?? "Someone"} published “${t?.title ?? "Untitled"}”`,
      at: ts(t?.created_at),
      href: `/track/${t?.legacy_id ?? t?.id ?? ""}`
    });
  }
  for (const c of s.comments.slice(0, 40)) {
    const owner = people.get(String(c?.user_id ?? ""));
    out.push({
      kind: "comment",
      label: `${owner?.name ?? "Someone"} left a comment`,
      at: ts(c?.created_at),
      href: `/track/${c?.track_id ?? ""}#comments`
    });
  }
  return out.filter((x) => x.at > 0).sort((a, b) => b.at - a.at).slice(0, limit);
}

export { NULL as _NULL };