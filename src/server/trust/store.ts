import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DB_MODE, SUPABASE_URL, SUPABASE_KEY, DATA_DIR } from "../env";
import { uuid } from "../crypto";
import type { TrustShape, ReportRow, RightsRow, StrikeRow, ModRow } from "./types";

const FILE = path.join(DATA_DIR, "trust.json");
let cache: TrustShape | null = null;
let chain: Promise<unknown> = Promise.resolve();

const empty = (): TrustShape => ({ reports: [], rights: [], strikes: [], actions: [], roles: [] });
const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

async function localLoad(): Promise<TrustShape> {
  if (cache) return cache;
  try { cache = { ...empty(), ...(JSON.parse(await fs.readFile(FILE, "utf8")) as TrustShape) }; }
  catch { cache = empty(); }
  return cache!;
}
async function localSave(): Promise<void> {
  const data = cache ?? empty();
  chain = chain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data), "utf8");
    await fs.rename(tmp, FILE);
  }).catch(() => undefined);
  await chain;
}

const root = () => SUPABASE_URL.replace(/\/+$/, "");
const hdr = (extra: Record<string, string> = {}) => ({
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: "application/json", "Content-Type": "application/json", ...extra
});
function url(table: string, filters: Record<string, string> = {}, extra: Record<string, string> = {}): string {
  return `${root()}/rest/v1/${table}?${new URLSearchParams({ select: "*", ...filters, ...extra }).toString()}`;
}
async function rest(table: string, method: "GET" | "POST" | "PATCH", filters: Record<string, string> = {}, body?: unknown, extra: Record<string, string> = {}, prefer?: string): Promise<any[]> {
  const res = await fetch(url(table, filters, extra), {
    method, headers: hdr(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    let d = text; try { d = JSON.parse(text)?.message ?? text; } catch { /* raw */ }
    throw new Error(`trust:${table} ${method} (${res.status}): ${d}`);
  }
  if (!text) return [];
  const j = JSON.parse(text);
  return Array.isArray(j) ? j : [j];
}
const eq = (v: string) => `eq.${v}`;
const nowIso = () => new Date().toISOString();

export interface TrustStore {
  all(): Promise<TrustShape>;
  insertReport(r: Omit<ReportRow, "id">): Promise<ReportRow>;
  patchReport(id: string, patch: Partial<ReportRow>): Promise<void>;
  findOpenReport(reporterId: string, trackId: string | null, commentId: string | null): Promise<ReportRow | null>;
  getRights(trackId: string): Promise<RightsRow | null>;
  upsertRights(row: RightsRow): Promise<void>;
  addStrike(s: Omit<StrikeRow, "id">): Promise<StrikeRow>;
  revokeStrikes(userId: string): Promise<void>;
  addActions(rows: Omit<ModRow, "id">[]): Promise<void>;
  undoBatch(batchId: string): Promise<ModRow[]>;
  roleOf(userId: string): Promise<"user" | "creator" | "moderator" | "admin" | null>;
  setRole(userId: string, role: "user" | "creator" | "moderator" | "admin"): Promise<void>;
}

function localStore(): TrustStore {
  return {
    async all() { return clone(await localLoad()); },
    async insertReport(r) {
      const db = await localLoad();
      const row: ReportRow = { ...r, id: uuid() };
      db.reports.push(row); await localSave(); return clone(row);
    },
    async patchReport(id, patch) {
      const db = await localLoad();
      const i = db.reports.findIndex((x) => x.id === id);
      if (i >= 0) { db.reports[i] = { ...db.reports[i], ...patch }; await localSave(); }
    },
    async findOpenReport(reporterId, trackId, commentId) {
      const db = await localLoad();
      return clone(db.reports.find((r) => r.reporter_id === reporterId && r.track_id === trackId && r.comment_id === commentId && (r.status === "open" || r.status === "reviewing")) ?? null);
    },
    async getRights(trackId) { return clone((await localLoad()).rights.find((r) => r.track_id === trackId) ?? null); },
    async upsertRights(row) {
      const db = await localLoad();
      const i = db.rights.findIndex((r) => r.track_id === row.track_id);
      if (i >= 0) db.rights[i] = row; else db.rights.push(row);
      await localSave();
    },
    async addStrike(s) {
      const db = await localLoad();
      const row: StrikeRow = { ...s, id: uuid() };
      db.strikes.push(row); await localSave(); return clone(row);
    },
    async revokeStrikes(userId) {
      const db = await localLoad(); let dirty = false;
      for (const s of db.strikes) if (s.user_id === userId && !s.revoked_at) { s.revoked_at = nowIso(); dirty = true; }
      if (dirty) await localSave();
    },
    async addActions(rows) {
      const db = await localLoad();
      for (const r of rows) db.actions.push({ ...r, id: uuid() });
      if (db.actions.length > 2000) db.actions = db.actions.slice(-2000);
      await localSave();
    },
    async undoBatch(batchId) {
      const db = await localLoad();
      const rows = db.actions.filter((a) => a.batch_id === batchId && !a.undone_at);
      for (const a of rows) a.undone_at = nowIso();
      await localSave(); return clone(rows);
    },
    async roleOf(userId) { return (await localLoad()).roles.find((r) => r.user_id === userId)?.role ?? null; },
    async setRole(userId, role) {
      const db = await localLoad();
      const i = db.roles.findIndex((r) => r.user_id === userId);
      if (i >= 0) db.roles[i].role = role; else db.roles.push({ user_id: userId, role });
      await localSave();
    }
  };
}

function supabaseStore(): TrustStore {
  return {
    async all() {
      const [reports, rights, strikes, actions, roles] = await Promise.all([
        rest("reports", "GET", {}, undefined, { order: "created_at.desc", limit: "500" }),
        rest("track_rights", "GET", {}, undefined, { limit: "3000" }),
        rest("user_strikes", "GET", {}, undefined, { order: "created_at.desc", limit: "1000" }),
        rest("moderation_actions", "GET", {}, undefined, { order: "created_at.desc", limit: "500" }),
        rest("staff_roles", "GET", {}, undefined, { limit: "200" })
      ]);
      return { reports, rights, strikes, actions, roles } as TrustShape;
    },
    async insertReport(r) { return (await rest("reports", "POST", {}, r, {}, "return=representation"))[0] as ReportRow; },
    async patchReport(id, patch) { await rest("reports", "PATCH", { id: eq(id) }, patch); },
    async findOpenReport(reporterId, trackId, commentId) {
      const f: Record<string, string> = { reporter_id: eq(reporterId), status: "in.(open,reviewing)" };
      f.track_id = trackId ? eq(trackId) : "is.null";
      f.comment_id = commentId ? eq(commentId) : "is.null";
      return ((await rest("reports", "GET", f, undefined, { limit: "1" }))[0] as ReportRow) ?? null;
    },
    async getRights(trackId) {
      return ((await rest("track_rights", "GET", { track_id: eq(trackId) }, undefined, { limit: "1" }))[0] as RightsRow) ?? null;
    },
    async upsertRights(row) {
      const res = await fetch(url("track_rights", {}, { on_conflict: "track_id" }), {
        method: "POST", headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(row), cache: "no-store"
      });
      if (!res.ok) throw new Error(`rights upsert: ${await res.text()}`);
    },
    async addStrike(s) { return (await rest("user_strikes", "POST", {}, s, {}, "return=representation"))[0] as StrikeRow; },
    async revokeStrikes(userId) { await rest("user_strikes", "PATCH", { user_id: eq(userId), revoked_at: "is.null" }, { revoked_at: nowIso() }); },
    async addActions(rows) { await rest("moderation_actions", "POST", {}, rows); },
    async undoBatch(batchId) {
      return (await rest("moderation_actions", "PATCH", { batch_id: eq(batchId), undone_at: "is.null" }, { undone_at: nowIso() }, {}, "return=representation")) as ModRow[];
    },
    async roleOf(userId) {
      return ((await rest("staff_roles", "GET", { user_id: eq(userId) }, undefined, { limit: "1" }))[0]?.role as "admin") ?? null;
    },
    async setRole(userId, role) {
      const res = await fetch(url("staff_roles", {}, { on_conflict: "user_id" }), {
        method: "POST", headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: userId, role }), cache: "no-store"
      });
      if (!res.ok) throw new Error(`role upsert: ${await res.text()}`);
    }
  };
}

let store: TrustStore | null = null;
export function trustStore(): TrustStore {
  if (!store) store = DB_MODE === "supabase" ? supabaseStore() : localStore();
  return store;
}