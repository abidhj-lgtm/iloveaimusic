"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Shield, LayoutDashboard, Users, Music2, Flag, Settings, Search, RefreshCw, X, Check,
  Ban, BadgeCheck, Star, Trash2, EyeOff, Eye, RotateCcw, ExternalLink, Play, Heart,
  MessageCircle, Disc3, TrendingUp, Activity, Database, Megaphone, Bell, Loader2,
  AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Bookmark,
  Plus, Minus, Lock, Home, UserPlus, Sparkles, Clock, Save, Inbox, Zap, ArrowLeft
} from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { avatarUrl, coverUrl } from "@/lib/covers";
import { formatCount, timeAgo } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui";

/* ══════════════ types ══════════════ */

type Role = "user" | "moderator" | "admin";
type Tab = "overview" | "creators" | "tracks" | "reports" | "system";

interface Stats { tracks: number; live: number; hidden: number; deleted: number; plays: number; likes: number; comments: number }
interface Creator {
  id: string; publicId: string; name: string; handle: string; email: string;
  verified: boolean; provider: string; bio: string; avatarPalette: number;
  role: Role; isOfficial: boolean; suspended: boolean; suspendedAt: string | null;
  createdAt: number; stats: Stats;
}
interface ATrack {
  id: string; publicId: string; title: string; userId: string;
  artistName: string; artistHandle: string; artistPalette: number;
  source: "upload" | "youtube" | "synth"; youtubeId: string | null;
  coverSeed: string; coverPalette: number; stylePrompt: string; background: string;
  instrumental: boolean; duration: number | null; plays: number; likes: number; comments: number;
  state: "live" | "hidden" | "deleted"; visibility: string; status: string;
  createdAt: number; updatedAt: number | null;
}
interface Overview {
  totals: {
    creators: number; admins: number; official: number; suspended: number; unverified: number;
    tracks: number; live: number; hidden: number; deleted: number;
    plays: number; likes: number; comments: number;
    creatorsToday: number; tracksToday: number;
  };
  series: { day: string; signups: number; uploads: number }[];
  sources: { key: string; label: string; count: number }[];
  topCreators: Creator[];
  recentTracks: ATrack[];
  reports: { pending: number; total: number };
}
interface ActivityItem { kind: string; label: string; at: number; href: string }
interface ReportRow { id: string; status?: string; reason?: string; details?: string; created_at?: string; track_id?: string | null; comment_id?: string | null; target_label?: string | null }
interface SavedView { id: string; name: string; tab: Tab; q: string; filter: string; sort: string; source?: string }

/* ══════════════ helpers ══════════════ */

async function jget(url: string) {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok && d?.ok !== false, status: res.status, ...d };
  } catch { return { ok: false, status: 0, error: "Network unreachable." }; }
}
async function jsend(url: string, method: "POST" | "PATCH", body: unknown) {
  try {
    const res = await fetch(url, {
      method, credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok && d?.ok !== false, status: res.status, ...d };
  } catch { return { ok: false, status: 0, error: "Network unreachable." }; }
}

const VIEWS_KEY = "iloveai:admin:views";
const loadViews = (): SavedView[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]"); } catch { return []; }
};
const storeViews = (v: SavedView[]) => { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v.slice(0, 24))); } catch { /* quota */ } };

const SOURCE_TONE: Record<string, string> = { upload: "var(--lime)", synth: "var(--violet)", youtube: "var(--red)" };
const nf = (n: number) => formatCount(Number.isFinite(n) ? n : 0);
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });

/* ══════════════ atoms ══════════════ */

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current, b = value, dur = 620;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{nf(n)}</>;
}

function Spark({ points, tone }: { points: number[]; tone: string }) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points);
  const w = 100, h = 26;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - (p / max) * (h - 3) - 1.5}`).join(" ");
  const id = `sp-${tone.replace(/[^a-z]/gi, "")}-${points.length}`;
  return (
    <svg className="adm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity=".38" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${d} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function StatTile({ icon, label, value, tone, foot, delta, spark }: {
  icon: React.ReactNode; label: string; value: number; tone: string;
  foot?: string; delta?: number; spark?: number[];
}) {
  return (
    <div className="adm-stat" style={{ ["--tone" as any]: tone }}>
      <div className="adm-stat-top">
        <span className="adm-stat-ico">{icon}</span>
        <span className="adm-stat-label">{label}</span>
      </div>
      <div className="adm-stat-num"><CountUp value={value} /></div>
      <div className="adm-stat-foot">
        {delta !== undefined && delta > 0 && <span className="adm-stat-delta">+{delta} today</span>}
        {foot && <span>{foot}</span>}
      </div>
      {spark && <Spark points={spark} tone={tone} />}
    </div>
  );
}

function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`adm-pill ${kind}`}>{children}</span>;
}

function SourcePill({ source }: { source: string }) {
  const label = source === "youtube" ? "YouTube" : source === "synth" ? "Synth" : "Upload";
  return <Pill kind={source}>{label}</Pill>;
}

function RolePill({ c }: { c: Creator }) {
  if (c.suspended) return <Pill kind="suspended"><Ban size={10} /> Suspended</Pill>;
  if (c.role === "admin") return <Pill kind="admin"><Shield size={10} /> Admin</Pill>;
  if (c.role === "moderator") return <Pill kind="moderator"><Shield size={10} /> Mod</Pill>;
  if (c.isOfficial) return <Pill kind="official"><Star size={10} /> Official</Pill>;
  return <Pill kind="user">Creator</Pill>;
}

function Empty({ icon, title, body, actions }: { icon: React.ReactNode; title: string; body: string; actions?: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-ico">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {actions && <div className="adm-empty-actions">{actions}</div>}
    </div>
  );
}

function SkelRows({ n = 6 }: { n?: number }) {
  return <div>{Array.from({ length: n }).map((_, i) => <div key={i} className="adm-skel adm-skel-row" style={{ animationDelay: `${i * 70}ms` }} />)}</div>;
}

/* ══════════════ growth chart ══════════════ */

function GrowthChart({ series }: { series: { day: string; signups: number; uploads: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 720, H = 236, PL = 40, PR = 14, PT = 16, PB = 30;
  const iw = W - PL - PR, ih = H - PT - PB;
  const max = Math.max(2, ...series.map((s) => Math.max(s.signups, s.uploads)));
  const ticks = 4;

  const x = (i: number) => PL + (series.length <= 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = (v: number) => PT + ih - (v / max) * ih;

  const line = (key: "signups" | "uploads") => series.map((s, i) => `${x(i)},${y(s[key])}`).join(" ");
  const area = (key: "signups" | "uploads") => `${PL},${PT + ih} ${line(key)} ${x(series.length - 1)},${PT + ih}`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PL) / iw) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  const h = hover != null ? series[hover] : null;

  return (
    <div className="adm-chart-wrap" ref={wrap}>
      <svg
        className="adm-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img" aria-label="Signups and uploads over the last 30 days"
      >
        <defs>
          <linearGradient id="gSign" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity=".42" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity=".40" /><stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (max / ticks) * i, yy = y(v);
          return (
            <g key={i}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#2c2447" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 5"} />
              <text x={PL - 8} y={yy + 3.5} textAnchor="end" fontSize="9.5" fill="#7a6f9c" fontWeight="700">{Math.round(v)}</text>
            </g>
          );
        })}

        <polygon points={area("signups")} fill="url(#gSign)" />
        <polygon points={area("uploads")} fill="url(#gUp)" />
        <polyline points={line("signups")} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={line("uploads")} fill="none" stroke="url(#gStroke)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

        {series.map((s, i) => (i % 5 === 0 || i === series.length - 1) ? (
          <text key={s.day} x={x(i)} y={H - 9} textAnchor="middle" fontSize="9.5" fill="#7a6f9c" fontWeight="700">{dayLabel(s.day)}</text>
        ) : null)}

        {hover != null && (
          <g>
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={PT + ih} stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(series[hover].signups)} r="4.5" fill="#22d3ee" stroke="#06040d" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(series[hover].uploads)} r="4.5" fill="#ec4899" stroke="#06040d" strokeWidth="2" />
          </g>
        )}
      </svg>

      {h && hover != null && (
        <div className="adm-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(Math.min(y(h.signups), y(h.uploads)) / H) * 100}%` }}>
          <b>{dayLabel(h.day)}</b>
          <u><i style={{ background: "#22d3ee" }} /> {h.signups} signup{h.signups === 1 ? "" : "s"}</u>
          <u><i style={{ background: "#ec4899" }} /> {h.uploads} upload{h.uploads === 1 ? "" : "s"}</u>
        </div>
      )}

      <div className="adm-legend">
        <span><i style={{ background: "#22d3ee" }} /> New creators</span>
        <span><i style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} /> Tracks published</span>
        <span><i style={{ background: "#fbbf24" }} /> Hover for a day</span>
      </div>
    </div>
  );
}

/* ══════════════ source donut ══════════════ */

function SourceDonut({ sources }: { sources: { key: string; label: string; count: number }[] }) {
  const total = sources.reduce((a, s) => a + s.count, 0);
  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="adm-donut-row">
      <svg className="adm-donut" viewBox="0 0 140 140" role="img" aria-label="Track source split">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#241d3f" strokeWidth="17" />
        {total > 0 && sources.map((s) => {
          const frac = s.count / total;
          const dash = frac * C;
          const el = (
            <circle
              key={s.key} cx="70" cy="70" r={R} fill="none"
              stroke={SOURCE_TONE[s.key] ?? "#8b5cf6"} strokeWidth="17"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc}
              transform="rotate(-90 70 70)" strokeLinecap="butt"
            />
          );
          acc += dash;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="24" fontWeight="800" fill="#f3eeff">{nf(total)}</text>
        <text x="70" y="83" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7a6f9c" letterSpacing="1.4">TRACKS</text>
      </svg>
      <div className="adm-donut-legend">
        {sources.map((s) => (
          <div key={s.key}>
            <i style={{ background: SOURCE_TONE[s.key] ?? "#8b5cf6" }} />
            {s.label}
            <b>{nf(s.count)}</b>
            <em>{total ? Math.round((s.count / total) * 100) : 0}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════ saved views ══════════════ */

function ViewsMenu({ tab, current, onApply }: {
  tab: Tab; current: { q: string; filter: string; sort: string; source?: string };
  onApply: (v: SavedView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => { setViews(loadViews()); }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const mine = views.filter((v) => v.tab === tab);

  const save = () => {
    const n = name.trim();
    if (!n) { toast.push({ kind: "err", msg: "Give the view a name first." }); return; }
    const v: SavedView = { id: `${Date.now()}`, name: n.slice(0, 40), tab, ...current };
    const next = [v, ...views];
    setViews(next); storeViews(next); setName("");
    toast.push({ kind: "ok", msg: `View “${n}” saved.` });
  };
  const remove = (id: string) => {
    const next = views.filter((v) => v.id !== id);
    setViews(next); storeViews(next);
  };

  return (
    <div className="adm-views" ref={box}>
      <button className={`adm-btn${open ? " primary" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Bookmark size={14} /> Views {mine.length > 0 && <b>({mine.length})</b>}
      </button>
      {open && (
        <div className="adm-views-pop">
          <div className="adm-label">Save current filters</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Suspended w/ tracks" maxLength={40}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            <button className="adm-btn primary" onClick={save} aria-label="Save view"><Save size={14} /></button>
          </div>
          <div className="adm-label">Saved</div>
          {mine.length === 0 ? (
            <div className="adm-views-empty">No saved views for this tab yet.</div>
          ) : mine.map((v) => (
            <div className="adm-view-row" key={v.id}>
              <button onClick={() => { onApply(v); setOpen(false); }}>{v.name}</button>
              <button className="adm-mini danger" onClick={() => remove(v.id)} aria-label={`Delete view ${v.name}`}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════ pager ══════════════ */

function Pager({ page, perPage, total, hasMore, onPage, onPerPage }: {
  page: number; perPage: number; total: number; hasMore: boolean;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className="adm-pager">
      <span className="adm-pager-info"><b>{from}–{to}</b> of <b>{nf(total)}</b></span>
      <select className="adm-select" value={perPage} onChange={(e) => onPerPage(Number(e.target.value))} aria-label="Rows per page">
        {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
      </select>
      <div className="adm-pager-btns">
        <button className="adm-mini" onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page"><ChevronsLeft size={14} /></button>
        <button className="adm-mini" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="adm-page-num">{page} / {pages}</span>
        <button className="adm-mini" onClick={() => onPage(page + 1)} disabled={!hasMore} aria-label="Next page"><ChevronRight size={14} /></button>
        <button className="adm-mini" onClick={() => onPage(pages)} disabled={page >= pages} aria-label="Last page"><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}

/* ══════════════ creator drawer ══════════════ */

function CreatorDrawer({ id, canDestroy, onClose, onCreatorAction, onTrackAction }: {
  id: string; canDestroy: boolean; onClose: () => void;
  onCreatorAction: (c: Creator, action: string) => void;
  onTrackAction: (t: ATrack, action: string) => void;
}) {
  const [data, setData] = useState<{ creator: Creator; tracks: ATrack[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const d = await jget(`/api/admin/creators/${encodeURIComponent(id)}`);
    if (d.ok) setData({ creator: d.creator, tracks: d.tracks ?? [] });
    else setErr(d.error ?? "Could not load this creator.");
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);

  const c = data?.creator;

  return (
    <>
      <div className="adm-scrim" onMouseDown={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label="Creator detail">
        <div className="adm-drawer-head">
          {c ? (
            <div className="adm-detail-hero">
              <img src={avatarUrl(c.name, c.avatarPalette)} alt="" />
              <div style={{ minWidth: 0 }}>
                <h3>
                  {c.name}
                  {c.verified && <BadgeCheck size={15} color="var(--cyan)" />}
                  {c.isOfficial && <Star size={14} color="var(--amber)" fill="var(--amber)" />}
                </h3>
                <p>@{c.handle} · joined {timeAgo(c.createdAt)}</p>
                <div style={{ marginTop: 6 }}><RolePill c={c} /></div>
              </div>
            </div>
          ) : <div className="adm-detail-hero"><h3>{loading ? "Loading creator…" : "Creator"}</h3></div>}
          <button className="adm-icon" onClick={onClose} aria-label="Close panel"><X size={16} /></button>
        </div>

        <div className="adm-drawer-body">
          {loading ? <SkelRows n={5} /> : err ? (
            <Empty icon={<AlertTriangle size={24} />} title="Could not load" body={err}
              actions={<button className="adm-btn primary" onClick={load}><RefreshCw size={14} /> Retry</button>} />
          ) : c && data ? (
            <>
              <div className="adm-mini-stats">
                <div className="adm-mini-stat"><b>{nf(c.stats.tracks)}</b><em>Tracks</em></div>
                <div className="adm-mini-stat"><b>{nf(c.stats.plays)}</b><em>Plays</em></div>
                <div className="adm-mini-stat"><b>{nf(c.stats.likes)}</b><em>Loves</em></div>
                <div className="adm-mini-stat"><b>{nf(c.stats.comments)}</b><em>Comments</em></div>
              </div>

              <dl className="adm-kv">
                <dt>Email</dt><dd>{c.email || <span style={{ color: "var(--faint)" }}>not on file</span>}</dd>
                <dt>Sign-in</dt><dd style={{ textTransform: "capitalize" }}>{c.provider}</dd>
                <dt>Verified</dt><dd>{c.verified ? "Yes" : "No"}</dd>
                <dt>Public ID</dt><dd style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{c.publicId}</dd>
                <dt>Standing</dt><dd>{c.suspended ? `Suspended ${c.suspendedAt ? timeAgo(Date.parse(c.suspendedAt)) : ""}` : "Active"}</dd>
                <dt>Visibility</dt><dd>{c.stats.live} live · {c.stats.hidden} hidden · {c.stats.deleted} deleted</dd>
                {c.bio && <><dt>Bio</dt><dd>{c.bio}</dd></>}
              </dl>

              <h4 className="adm-sect-title"><Music2 size={13} /> Catalog <b>{data.tracks.length}</b></h4>
              {data.tracks.length === 0 ? (
                <div className="adm-views-empty" style={{ padding: 18 }}>This creator has not published anything yet.</div>
              ) : data.tracks.map((t) => (
                <div className="adm-dtrack" key={t.id}>
                  <img src={coverUrl(t.coverSeed, t.coverPalette)} alt="" />
                  <div className="adm-dtrack-txt">
                    <strong>{t.title}</strong>
                    <div className="adm-dtrack-meta">
                      <SourcePill source={t.source} />
                      <Pill kind={t.state}>{t.state}</Pill>
                      <span><Play size={9} /> {nf(t.plays)}</span>
                      <span><Heart size={9} /> {nf(t.likes)}</span>
                      <span><MessageCircle size={9} /> {nf(t.comments)}</span>
                    </div>
                  </div>
                  <div className="adm-row-actions">
                    <Link className="adm-mini" href={`/track/${t.publicId}`} target="_blank" aria-label="Open track"><ExternalLink size={12} /></Link>
                    {canDestroy && t.state !== "deleted" && (
                      <button className="adm-mini" onClick={() => onTrackAction(t, t.state === "hidden" ? "publish" : "hide")} aria-label={t.state === "hidden" ? "Publish" : "Hide"}>
                        {t.state === "hidden" ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    )}
                    {canDestroy && (
                      <button className={`adm-mini ${t.state === "deleted" ? "good" : "danger"}`}
                        onClick={() => onTrackAction(t, t.state === "deleted" ? "restore" : "delete")}
                        aria-label={t.state === "deleted" ? "Restore" : "Delete"}>
                        {t.state === "deleted" ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {c && (
          <div className="adm-drawer-foot">
            <Link className="adm-btn" href={`/profile/${c.handle}`} target="_blank"><ExternalLink size={13} /> Profile</Link>
            {canDestroy && (
              <>
                <button className={`adm-btn ${c.suspended ? "good" : "danger"}`} onClick={() => onCreatorAction(c, c.suspended ? "restore" : "suspend")}>
                  {c.suspended ? <><RotateCcw size={13} /> Reinstate</> : <><Ban size={13} /> Suspend</>}
                </button>
                <button className="adm-btn" onClick={() => onCreatorAction(c, c.verified ? "unverify" : "verify")}>
                  <BadgeCheck size={13} /> {c.verified ? "Unverify" : "Verify"}
                </button>
                <button className="adm-btn" onClick={() => onCreatorAction(c, c.isOfficial ? "unofficial" : "official")}>
                  <Star size={13} /> {c.isOfficial ? "Unmark official" : "Mark official"}
                </button>
                <button className="adm-btn" onClick={() => onCreatorAction(c, c.role === "user" ? "promote" : "demote")}>
                  <Shield size={13} /> {c.role === "user" ? "Make moderator" : "Remove staff"}
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/* ══════════════ track drawer ══════════════ */

function TrackDrawer({ track, canDestroy, onClose, onAction }: {
  track: ATrack; canDestroy: boolean; onClose: () => void; onAction: (t: ATrack, a: string) => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <>
      <div className="adm-scrim" onMouseDown={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label="Track detail">
        <div className="adm-drawer-head">
          <div className="adm-detail-hero">
            <img src={coverUrl(track.coverSeed, track.coverPalette)} alt="" style={{ borderRadius: 12 }} />
            <div style={{ minWidth: 0 }}>
              <h3>{track.title}</h3>
              <p>{track.artistName} · @{track.artistHandle}</p>
              <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                <SourcePill source={track.source} /><Pill kind={track.state}>{track.state}</Pill>
              </div>
            </div>
          </div>
          <button className="adm-icon" onClick={onClose} aria-label="Close panel"><X size={16} /></button>
        </div>

        <div className="adm-drawer-body">
          <div className="adm-mini-stats">
            <div className="adm-mini-stat"><b>{nf(track.plays)}</b><em>Plays</em></div>
            <div className="adm-mini-stat"><b>{nf(track.likes)}</b><em>Loves</em></div>
            <div className="adm-mini-stat"><b>{nf(track.comments)}</b><em>Comments</em></div>
            <div className="adm-mini-stat"><b>{track.instrumental ? "INST" : "VOC"}</b><em>Type</em></div>
          </div>

          <dl className="adm-kv">
            <dt>Published</dt><dd>{new Date(track.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</dd>
            <dt>Updated</dt><dd>{track.updatedAt ? timeAgo(track.updatedAt) : "never"}</dd>
            <dt>Visibility</dt><dd>{track.visibility}</dd>
            <dt>Status</dt><dd>{track.status}</dd>
            <dt>Track ID</dt><dd style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{track.publicId}</dd>
            {track.youtubeId && <><dt>YouTube</dt><dd><a href={`https://youtu.be/${track.youtubeId}`} target="_blank" rel="noreferrer">{track.youtubeId}</a></dd></>}
          </dl>

          {track.stylePrompt && (
            <>
              <h4 className="adm-sect-title"><Sparkles size={13} /> Style prompt</h4>
              <div className="adm-slow" style={{ marginBottom: 16 }}>{track.stylePrompt}</div>
            </>
          )}
          {track.background && (
            <>
              <h4 className="adm-sect-title"><MessageCircle size={13} /> Background</h4>
              <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>{track.background}</p>
            </>
          )}
        </div>

        <div className="adm-drawer-foot">
          <Link className="adm-btn" href={`/track/${track.publicId}`} target="_blank"><ExternalLink size={13} /> Open</Link>
          <Link className="adm-btn" href={`/profile/${track.artistHandle}`} target="_blank"><Users size={13} /> Artist</Link>
          {canDestroy && (
            <>
              {track.state !== "deleted" && (
                <button className="adm-btn" onClick={() => onAction(track, track.state === "hidden" ? "publish" : "hide")}>
                  {track.state === "hidden" ? <><Eye size={13} /> Publish</> : <><EyeOff size={13} /> Hide</>}
                </button>
              )}
              <button className={`adm-btn ${track.state === "deleted" ? "good" : "danger"}`}
                onClick={() => onAction(track, track.state === "deleted" ? "restore" : "delete")}>
                {track.state === "deleted" ? <><RotateCcw size={13} /> Restore</> : <><Trash2 size={13} /> Delete</>}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* ══════════════ system tab ══════════════ */

function SystemTab() {
  const toast = useToast();
  const [health, setHealth] = useState<any>(null);
  const [slow, setSlow] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState("");
  const [ann, setAnn] = useState({ title: "", body: "", link: "", expiresHours: 168 });
  const [result, setResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const loadHealth = useCallback(async () => {
    const [h, s] = await Promise.all([jget("/api/health"), jget("/api/admin/db-stats")]);
    setHealth(h); setSlow(s);
  }, []);
  useEffect(() => { void loadHealth(); }, [loadHealth]);

  const broadcast = async () => {
    if (!ann.title.trim() || !ann.body.trim()) { setResult({ kind: "err", msg: "Title and body are both required." }); return; }
    setBusy("ann"); setResult(null);
    const r = await jsend("/api/admin/announcements", "POST", {
      title: ann.title.trim(), body: ann.body.trim(),
      link: ann.link.trim() || null, expiresHours: ann.expiresHours
    });
    setBusy("");
    if (r.ok) {
      setResult({ kind: "ok", msg: `Announcement delivered to ${r.sent ?? 0} creator${r.sent === 1 ? "" : "s"}.` });
      setAnn({ title: "", body: "", link: "", expiresHours: 168 });
      toast.push({ kind: "ok", msg: "Announcement sent." });
    } else setResult({ kind: "err", msg: r.error ?? "Broadcast failed." });
  };

  const cleanup = async () => {
    setBusy("clean"); setResult(null);
    const r = await jsend(`/api/admin/notifications/cleanup?days=${days}`, "POST", {});
    setBusy("");
    if (r.ok) {
      setResult({ kind: "ok", msg: `Removed ${r.deleted ?? 0} notification${r.deleted === 1 ? "" : "s"} older than ${days} days.` });
      toast.push({ kind: "ok", msg: "Notification cleanup complete." });
    } else setResult({ kind: "err", msg: r.error ?? "Cleanup failed." });
  };

  const warnings: string[] = Array.isArray(health?.warnings) ? health.warnings : [];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">System <span>operations</span></h1>
          <p className="adm-sub">Broadcast to every creator, prune old notifications, and watch the database.</p>
        </div>
        <div className="adm-head-right">
          <button className="adm-btn" onClick={() => setTab("overview")}><ArrowLeft size={14} /> Back to overview</button>
          <button className="adm-btn" onClick={loadHealth}><RefreshCw size={14} /> Re-check</button>
        </div>
      </div>

      <div className="adm-sys-grid">
        <section className="adm-panel">
          <div className="adm-panel-head">
            <h2 className="adm-panel-title"><Megaphone size={16} /> Broadcast announcement</h2>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="ann-t">Title</label>
            <input id="ann-t" className="adm-input" value={ann.title} maxLength={120}
              onChange={(e) => setAnn({ ...ann, title: e.target.value })} placeholder="New: playlist sharing is live" />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="ann-b">Message</label>
            <textarea id="ann-b" className="adm-textarea" value={ann.body} maxLength={2000}
              onChange={(e) => setAnn({ ...ann, body: e.target.value })} placeholder="Tell every creator what changed and why it matters." />
            <div className="adm-hint">{ann.body.length} / 2000 characters · lands in every notification bell.</div>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="ann-l">Link (optional)</label>
            <input id="ann-l" className="adm-input" value={ann.link}
              onChange={(e) => setAnn({ ...ann, link: e.target.value })} placeholder="https://iloveaimusic.com/discover" />
          </div>
          <div className="adm-field">
            <span className="adm-label">Expires after</span>
            <div className="adm-stepper">
              <button className="adm-mini" onClick={() => setAnn((a) => ({ ...a, expiresHours: Math.max(1, a.expiresHours - 24) }))} aria-label="Decrease"><Minus size={13} /></button>
              <b>{Math.round(ann.expiresHours / 24)}d</b>
              <button className="adm-mini" onClick={() => setAnn((a) => ({ ...a, expiresHours: Math.min(720, a.expiresHours + 24) }))} aria-label="Increase"><Plus size={13} /></button>
            </div>
          </div>
          <button className="adm-btn primary" onClick={broadcast} disabled={busy === "ann"}>
            {busy === "ann" ? <Loader2 size={14} className="adm-spin" /> : <Megaphone size={14} />} Send to all creators
          </button>
          {result && <div className={`adm-result ${result.kind}`}>{result.kind === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />} {result.msg}</div>}
        </section>

        <section className="adm-panel">
          <div className="adm-panel-head">
            <h2 className="adm-panel-title"><Bell size={16} /> Notification retention</h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 14px" }}>
            Notifications older than the window below are permanently deleted. Run this monthly to keep the table lean.
          </p>
          <div className="adm-field">
            <span className="adm-label">Keep notifications for</span>
            <div className="adm-stepper">
              <button className="adm-mini" onClick={() => setDays((d) => Math.max(7, d - 7))} aria-label="Decrease days"><Minus size={13} /></button>
              <b>{days}d</b>
              <button className="adm-mini" onClick={() => setDays((d) => Math.min(365, d + 7))} aria-label="Increase days"><Plus size={13} /></button>
            </div>
            <div className="adm-hint">Minimum 7 days, maximum 365.</div>
          </div>
          <button className="adm-btn danger" onClick={cleanup} disabled={busy === "clean"}>
            {busy === "clean" ? <Loader2 size={14} className="adm-spin" /> : <Trash2 size={14} />} Prune older than {days} days
          </button>

          <div style={{ marginTop: 20 }}>
            <h4 className="adm-sect-title"><Activity size={13} /> Component health</h4>
            {!health ? <SkelRows n={3} /> : (
              <div className="adm-health">
                <div className="adm-health-row">
                  <Pill kind={health?.checks?.db?.ok ? "live" : "deleted"}>{health?.checks?.db?.ok ? "OK" : "DOWN"}</Pill>
                  <b>Database</b><span>{health?.checks?.db?.ms ?? 0} ms</span>
                </div>
                <div className="adm-health-row">
                  <Pill kind={health?.checks?.redis?.ok ? "live" : "hidden"}>{health?.checks?.redis?.ok ? "OK" : "LOCAL"}</Pill>
                  <b>Rate limiter</b><span>{health?.rateLimit ?? "—"}</span>
                </div>
                <div className="adm-health-row">
                  <Pill kind={health?.email === "resend" ? "live" : "hidden"}>{health?.email === "resend" ? "LIVE" : "DEV"}</Pill>
                  <b>Email</b><span>{health?.email ?? "—"}</span>
                </div>
                <div className="adm-health-row">
                  <Pill kind={health?.backups === "enabled" ? "live" : "hidden"}>{health?.backups === "enabled" ? "ON" : "OFF"}</Pill>
                  <b>Backups</b><span>{health?.backups ?? "—"}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="adm-panel">
          <div className="adm-panel-head">
            <h2 className="adm-panel-title"><Database size={16} /> Slowest queries</h2>
            <span className="adm-panel-note">pg_stat_statements</span>
          </div>
          {!slow ? <SkelRows n={4} /> : !slow.available ? (
            <div className="adm-warn">
              <AlertTriangle size={15} />
              <span>Enable monitoring with <code>create extension if not exists pg_stat_statements;</code> then create the <code>get_slow_queries</code> function.</span>
            </div>
          ) : (slow.queries ?? []).length === 0 ? (
            <div className="adm-views-empty" style={{ padding: 18 }}>No query samples recorded yet.</div>
          ) : (slow.queries ?? []).slice(0, 6).map((q: any, i: number) => (
            <div className="adm-slow" key={i}>
              <b>{q.meanTimeMs ?? q.mean_time_ms ?? 0} ms avg</b> · {q.calls ?? 0} calls<br />{q.query}
            </div>
          ))}
        </section>

        <section className="adm-panel">
          <div className="adm-panel-head">
            <h2 className="adm-panel-title"><AlertTriangle size={16} /> Configuration warnings</h2>
            <span className="adm-panel-note">{warnings.length}</span>
          </div>
          {!health ? <SkelRows n={3} /> : warnings.length === 0 ? (
            <div className="adm-result ok"><Check size={14} /> Every production switch is configured.</div>
          ) : warnings.map((w, i) => (
            <div className="adm-warn" key={i}><AlertTriangle size={15} /><span>{w}</span></div>
          ))}
          {health?.release && (
            <div className="adm-hint" style={{ marginTop: 12 }}>
              Release <code>{String(health.release).slice(0, 12)}</code> · {health.env}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ══════════════ main page ══════════════ */

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={17} /> },
  { id: "creators", label: "Creators", icon: <Users size={17} /> },
  { id: "tracks", label: "Tracks", icon: <Music2 size={17} /> },
  { id: "reports", label: "Reports", icon: <Flag size={17} /> },
  { id: "system", label: "System", icon: <Settings size={17} /> }
];

export default function AdminConsole() {
  const { currentUser } = useStore();
  const toast = useToast();

  const [gate, setGate] = useState<"loading" | "ok" | "locked" | "signedout">("loading");
  const [role, setRole] = useState<Role>("user");
  const [tab, setTab] = useState<Tab>("overview");
  const [globalQ, setGlobalQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [ov, setOv] = useState<Overview | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovErr, setOvErr] = useState("");

  const [creators, setCreators] = useState<Creator[]>([]);
  const [cMeta, setCMeta] = useState({ total: 0, page: 1, perPage: 25, hasMore: false });
  const [cQ, setCQ] = useState(""); const [cFilter, setCFilter] = useState("all"); const [cSort, setCSort] = useState("plays");
  const [cLoading, setCLoading] = useState(false); const [cErr, setCErr] = useState("");

  const [tracks, setTracks] = useState<ATrack[]>([]);
  const [tMeta, setTMeta] = useState({ total: 0, page: 1, perPage: 25, hasMore: false });
  const [tQ, setTQ] = useState(""); const [tFilter, setTFilter] = useState("all");
  const [tSource, setTSource] = useState("all"); const [tSort, setTSort] = useState("newest");
  const [tLoading, setTLoading] = useState(false); const [tErr, setTErr] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [rLoading, setRLoading] = useState(false); const [rErr, setRErr] = useState("");

  const [drawerCreator, setDrawerCreator] = useState<string | null>(null);
  const [drawerTrack, setDrawerTrack] = useState<ATrack | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => void } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const canDestroy = role === "admin";

  /* ── gate ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentUser) { if (alive) setGate("signedout"); return; }
      const d = await jget("/api/admin/me");
      if (!alive) return;
      if (d.ok && d.isAdmin) { setRole(d.role ?? "moderator"); setGate("ok"); }
      else setGate("locked");
    })();
    return () => { alive = false; };
  }, [currentUser]);

  /* ── keyboard: / focuses search, 1-5 switch tabs ── */
  useEffect(() => {
    if (gate !== "ok") return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (!typing && !e.metaKey && !e.ctrlKey && /^[1-5]$/.test(e.key)) setTab(TABS[Number(e.key) - 1].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [gate]);

  /* ── loaders ── */
  const loadOverview = useCallback(async () => {
    setOvLoading(true); setOvErr("");
    const d = await jget("/api/admin/overview");
    if (d.ok) { setOv(d.overview); setActivity(d.activity ?? []); }
    else setOvErr(d.error ?? "Could not load the overview.");
    setOvLoading(false);
  }, []);

  const loadCreators = useCallback(async (page = cMeta.page) => {
    setCLoading(true); setCErr("");
    const p = new URLSearchParams({ q: cQ, filter: cFilter, sort: cSort, page: String(page), perPage: String(cMeta.perPage) });
    const d = await jget(`/api/admin/creators?${p}`);
    if (d.ok) { setCreators(d.items ?? []); setCMeta({ total: d.total ?? 0, page: d.page ?? 1, perPage: d.perPage ?? 25, hasMore: !!d.hasMore }); }
    else setCErr(d.error ?? "Could not load creators.");
    setCLoading(false);
  }, [cQ, cFilter, cSort, cMeta.page, cMeta.perPage]);

  const loadTracks = useCallback(async (page = tMeta.page) => {
    setTLoading(true); setTErr("");
    const p = new URLSearchParams({ q: tQ, filter: tFilter, source: tSource, sort: tSort, page: String(page), perPage: String(tMeta.perPage) });
    const d = await jget(`/api/admin/tracks?${p}`);
    if (d.ok) { setTracks(d.items ?? []); setTMeta({ total: d.total ?? 0, page: d.page ?? 1, perPage: d.perPage ?? 25, hasMore: !!d.hasMore }); setSel(new Set()); }
    else setTErr(d.error ?? "Could not load tracks.");
    setTLoading(false);
  }, [tQ, tFilter, tSource, tSort, tMeta.page, tMeta.perPage]);

  const loadReports = useCallback(async () => {
    setRLoading(true); setRErr("");
    const d = await jget("/api/reports");
    if (d.ok) setReports(d.reports ?? d.items ?? []);
    else setRErr(d.error ?? "Reports are unavailable.");
    setRLoading(false);
  }, []);

  useEffect(() => { if (gate === "ok" && tab === "overview") void loadOverview(); }, [gate, tab, loadOverview]);
  useEffect(() => { if (gate === "ok" && tab === "creators") void loadCreators(1); }, [gate, tab, cQ, cFilter, cSort, cMeta.perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (gate === "ok" && tab === "tracks") void loadTracks(1); }, [gate, tab, tQ, tFilter, tSource, tSort, tMeta.perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (gate === "ok" && tab === "reports") void loadReports(); }, [gate, tab, loadReports]);

  /* ── global search routes to the right tab ── */
  const submitGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQ.trim();
    if (tab === "tracks") setTQ(q);
    else if (tab === "creators") setCQ(q);
    else { setCQ(q); setTab("creators"); }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    if (tab === "overview") await loadOverview();
    else if (tab === "creators") await loadCreators();
    else if (tab === "tracks") await loadTracks();
    else if (tab === "reports") await loadReports();
    setRefreshing(false);
    toast.push({ kind: "ok", msg: "Console refreshed." });
  };

  /* ── creator mutation with optimistic update + undo ── */
  const creatorAction = useCallback((c: Creator, action: string) => {
    const run = async () => {
      const before = c;
      const optimistic = (x: Creator): Creator => {
        switch (action) {
          case "suspend": return { ...x, suspended: true, suspendedAt: new Date().toISOString() };
          case "restore": return { ...x, suspended: false, suspendedAt: null };
          case "verify": return { ...x, verified: true };
          case "unverify": return { ...x, verified: false };
          case "official": return { ...x, isOfficial: true };
          case "unofficial": return { ...x, isOfficial: false };
          case "promote": return { ...x, role: "moderator" };
          case "demote": return { ...x, role: "user" };
          default: return x;
        }
      };
      setCreators((p) => p.map((x) => (x.id === c.id ? optimistic(x) : x)));
      setOv((o) => o ? { ...o, topCreators: o.topCreators.map((x) => (x.id === c.id ? optimistic(x) : x)) } : o);

      const r = await jsend(`/api/admin/creators/${encodeURIComponent(c.id)}`, "PATCH", { action });
      if (!r.ok) {
        setCreators((p) => p.map((x) => (x.id === c.id ? before : x)));
        toast.push({ kind: "err", msg: r.error ?? "That change did not stick." });
        return;
      }
      const labels: Record<string, string> = {
        suspend: "suspended", restore: "reinstated", verify: "verified", unverify: "unverified",
        official: "marked official", unofficial: "unmarked", promote: "made moderator", demote: "removed from staff"
      };
      const inverse: Record<string, string> = {
        suspend: "restore", restore: "suspend", verify: "unverify", unverify: "verify",
        official: "unofficial", unofficial: "official", promote: "demote", demote: "promote"
      };
      toast.push({
        kind: "ok", msg: `${c.name} ${labels[action] ?? "updated"}.`,
        action: { label: "Undo", fn: () => { void (async () => { await jsend(`/api/admin/creators/${encodeURIComponent(c.id)}`, "PATCH", { action: inverse[action] }); setCreators((p) => p.map((x) => (x.id === c.id ? before : x))); toast.push({ kind: "info", msg: "Reverted." }); })(); } }
      });
      if (drawerCreator) setDrawerCreator(null);
      void loadOverview();
    };

    if (action === "suspend" || action === "demote") {
      setConfirm({
        title: action === "suspend" ? `Suspend ${c.name}?` : `Remove staff rights from ${c.name}?`,
        body: action === "suspend"
          ? "They keep their catalog but lose standing on the platform. You can reinstate them at any time."
          : "They drop back to a normal creator account. Admin rights are unaffected.",
        label: action === "suspend" ? "Suspend" : "Remove rights",
        run
      });
    } else void run();
  }, [toast, drawerCreator, loadOverview]);

  /* ── track mutation with optimistic update + undo ── */
  const trackAction = useCallback((t: ATrack, action: string) => {
    const run = async () => {
      const nextState: ATrack["state"] = action === "delete" ? "deleted" : action === "hide" ? "hidden" : "live";
      const patch = (x: ATrack): ATrack => ({ ...x, state: nextState, visibility: action === "hide" ? "unlisted" : "public", status: action === "hide" ? x.status : "published" });
      const before = t;
      setTracks((p) => p.map((x) => (x.id === t.id ? patch(x) : x)));

      const r = await jsend(`/api/admin/tracks/${encodeURIComponent(t.id)}`, "PATCH", { action });
      if (!r.ok) {
        setTracks((p) => p.map((x) => (x.id === t.id ? before : x)));
        toast.push({ kind: "err", msg: r.error ?? "That change did not stick." });
        return;
      }
      const labels: Record<string, string> = { hide: "hidden", publish: "published", delete: "deleted", restore: "restored" };
      const inverse: Record<string, string> = { hide: "publish", publish: "hide", delete: "restore", restore: "delete" };
      toast.push({
        kind: "ok", msg: `“${t.title}” ${labels[action]}.`,
        action: { label: "Undo", fn: () => { void (async () => { await jsend(`/api/admin/tracks/${encodeURIComponent(t.id)}`, "PATCH", { action: inverse[action] }); setTracks((p) => p.map((x) => (x.id === t.id ? before : x))); toast.push({ kind: "info", msg: "Reverted." }); })(); } }
      });
      setDrawerTrack(null);
    };

    if (action === "delete") {
      setConfirm({ title: `Delete “${t.title}”?`, body: "It disappears from the feed and the artist's profile. Restore is available from the Deleted filter.", label: "Delete", run });
    } else void run();
  }, [toast]);

  /* ── bulk ── */
  const bulk = (action: string) => {
    const ids = [...sel];
    if (!ids.length) return;
    const run = async () => {
      const snapshot = tracks;
      const nextState: ATrack["state"] = action === "delete" ? "deleted" : action === "hide" ? "hidden" : "live";
      setTracks((p) => p.map((x) => (sel.has(x.id) ? { ...x, state: nextState, visibility: action === "hide" ? "unlisted" : "public" } : x)));
      setSel(new Set());
      const r = await jsend("/api/admin/tracks", "POST", { ids, action });
      if (!r.ok) { setTracks(snapshot); toast.push({ kind: "err", msg: r.error ?? "Bulk action failed." }); return; }
      toast.push({
        kind: "ok", msg: `${r.changed ?? ids.length} track${(r.changed ?? ids.length) === 1 ? "" : "s"} ${action === "delete" ? "deleted" : action === "hide" ? "hidden" : "published"}.`,
        action: { label: "Undo", fn: () => { void (async () => {
          const inverse: Record<string, string> = { hide: "publish", publish: "hide", delete: "restore", restore: "publish" };
          await jsend("/api/admin/tracks", "POST", { ids, action: inverse[action] });
          setTracks(snapshot); toast.push({ kind: "info", msg: "Bulk action reverted." });
        })(); } }
      });
    };
    if (action === "delete") setConfirm({ title: `Delete ${ids.length} tracks?`, body: "All selected tracks leave the feed. You can restore them from the Deleted filter.", label: `Delete ${ids.length}`, run });
    else run();
  };

  const allSelected = tracks.length > 0 && tracks.every((t) => sel.has(t.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(tracks.map((t) => t.id)));
  const toggleOne = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const applyView = (v: SavedView) => {
    if (v.tab === "creators") { setCQ(v.q); setCFilter(v.filter); setCSort(v.sort); }
    if (v.tab === "tracks") { setTQ(v.q); setTFilter(v.filter); setTSort(v.sort); setTSource(v.source ?? "all"); }
    setTab(v.tab);
    toast.push({ kind: "ok", msg: `View “${v.name}” applied.` });
  };

  const sparkSignups = useMemo(() => (ov?.series ?? []).slice(-14).map((s) => s.signups), [ov]);
  const sparkUploads = useMemo(() => (ov?.series ?? []).slice(-14).map((s) => s.uploads), [ov]);

  /* ── gates ── */
  if (gate === "loading") {
    return (
      <div className="adm-lock">
        <div className="adm-lock-card">
          <div className="adm-lock-ico" style={{ background: "rgba(139,92,246,.14)", borderColor: "rgba(139,92,246,.32)", color: "var(--violet)" }}>
            <Loader2 size={26} className="adm-spin" />
          </div>
          <h1>Verifying staff access</h1>
          <p>Checking your role against the platform roster…</p>
        </div>
      </div>
    );
  }

  if (gate === "signedout") {
    return (
      <div className="adm-lock">
        <div className="adm-lock-card">
          <div className="adm-lock-ico" style={{ background: "rgba(34,211,238,.14)", borderColor: "rgba(34,211,238,.32)", color: "var(--cyan)" }}><Lock size={26} /></div>
          <h1>Sign in required</h1>
          <p>The staff console is only available to signed-in administrators and moderators.</p>
          <div className="adm-empty-actions">
            <Link className="adm-btn primary" href="/login?next=%2Fadmin"><Shield size={14} /> Sign in</Link>
            <Link className="adm-btn" href="/"><Home size={14} /> Back to feed</Link>
          </div>
        </div>
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="adm-lock">
        <div className="adm-lock-card">
          <div className="adm-lock-ico"><Ban size={26} /></div>
          <h1>Staff access only</h1>
          <p>
            {currentUser?.name ?? "This account"} does not have moderator or administrator rights.
            Ask an existing admin to promote the account from the Creators tab.
          </p>
          <div className="adm-empty-actions">
            <Link className="adm-btn primary" href="/"><Home size={14} /> Back to feed</Link>
            <Link className="adm-btn" href="/analytics"><TrendingUp size={14} /> Your analytics</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── console ── */
  const pending = ov?.reports?.pending ?? 0;

  return (
    <>
      <header className="adm-bar">
        <Link href="/" className="adm-brand" aria-label="Back to I Love AI Music">
          <span className="adm-brand-mark"><Shield size={17} color="#fff" /></span>
          <span className="adm-brand-txt"><strong>I Love AI Music</strong><em>Backstage</em></span>
        </Link>

        <form className="adm-search" onSubmit={submitGlobal}>
          <Search size={15} />
          <input
            ref={searchRef} value={globalQ} onChange={(e) => setGlobalQ(e.target.value)}
            placeholder={tab === "tracks" ? "Search tracks, artists, prompts…" : "Search creators by name, handle, email…"}
            aria-label="Search the console"
          />
          <span className="adm-kbd">/</span>
        </form>

        <div className="adm-bar-right">
          <span className={`adm-pulse${pending > 0 ? " warn" : ""}`}>
            <i /> {pending > 0 ? `${pending} report${pending === 1 ? "" : "s"} open` : "All clear"}
          </span>
          <button className="adm-icon" onClick={refreshAll} disabled={refreshing} aria-label="Refresh console">
            <RefreshCw size={15} className={refreshing ? "adm-spin" : ""} />
          </button>
          <div className="adm-me">
            {currentUser && <img src={avatarUrl(currentUser.name, currentUser.avatarPalette)} alt="" />}
            <span>{currentUser?.name ?? "Staff"}</span>
            <em>{role}</em>
          </div>
        </div>
      </header>

      <nav className="adm-rail" aria-label="Console sections">
        <div className="adm-rail-label">Moderation</div>
        {TABS.map((t, i) => (
          <button key={t.id} className={`adm-nav${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            {t.icon}<span>{t.label}</span>
            {t.id === "creators" && ov && <span className="adm-nav-count">{nf(ov.totals.creators)}</span>}
            {t.id === "tracks" && ov && <span className="adm-nav-count">{nf(ov.totals.tracks)}</span>}
            {t.id === "reports" && <span className={`adm-nav-count${pending > 0 ? " hot" : ""}`}>{pending}</span>}
            {t.id === "overview" && <span className="adm-nav-count">{i + 1}</span>}
            {t.id === "system" && <span className="adm-nav-count">{i + 1}</span>}
          </button>
        ))}
        <div className="adm-rail-foot">
          <Link href="/"><ArrowLeft size={13} /> Back to the feed</Link>
          <Link href="/analytics"><TrendingUp size={13} /> Creator analytics</Link>
          <Link href="/legal/dmca"><Flag size={13} /> Takedown policy</Link>
        </div>
      </nav>

      <main className="adm-main">
        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <>
            <div className="adm-head">
              <div>
                <h1 className="adm-h1">Platform <span>pulse</span></h1>
                <p className="adm-sub">Everything happening across I Love AI Music, right now.</p>
              </div>
              <div className="adm-head-right">
                <button className="adm-btn" onClick={() => setTab("creators")}><Users size={14} /> Manage creators</button>
                <button className="adm-btn primary" onClick={() => setTab("reports")}><Flag size={14} /> Review queue</button>
              </div>
            </div>

            {ovLoading ? (
              <>
                <div className="adm-stats">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="adm-skel" style={{ height: 122 }} />)}</div>
                <SkelRows n={4} />
              </>
            ) : ovErr ? (
              <Empty icon={<AlertTriangle size={24} />} title="Overview unavailable" body={ovErr}
                actions={<button className="adm-btn primary" onClick={loadOverview}><RefreshCw size={14} /> Try again</button>} />
            ) : ov ? (
              <>
                <div className="adm-stats">
                  <StatTile icon={<Users size={14} />} label="Creators" value={ov.totals.creators} tone="var(--cyan)" delta={ov.totals.creatorsToday} foot={`${ov.totals.unverified} unverified`} spark={sparkSignups} />
                  <StatTile icon={<Music2 size={14} />} label="Tracks" value={ov.totals.tracks} tone="var(--magenta)" delta={ov.totals.tracksToday} foot={`${ov.totals.live} live`} spark={sparkUploads} />
                  <StatTile icon={<Play size={14} />} label="Total plays" value={ov.totals.plays} tone="var(--violet)" foot="across live catalog" />
                  <StatTile icon={<Heart size={14} />} label="Loves" value={ov.totals.likes} tone="var(--red)" foot="creator appreciation" />
                  <StatTile icon={<MessageCircle size={14} />} label="Comments" value={ov.totals.comments} tone="var(--lime)" foot="conversation volume" />
                  <StatTile icon={<Flag size={14} />} label="Open reports" value={ov.reports.pending} tone="var(--amber)" foot={`${ov.reports.total} lifetime`} />
                </div>

                <div className="adm-grid-2">
                  <section className="adm-panel">
                    <div className="adm-panel-head">
                      <h2 className="adm-panel-title"><TrendingUp size={16} /> Growth · last 30 days</h2>
                      <span className="adm-panel-note">{ov.series.reduce((a, s) => a + s.uploads, 0)} tracks published</span>
                    </div>
                    <GrowthChart series={ov.series} />
                  </section>

                  <section className="adm-panel">
                    <div className="adm-panel-head"><h2 className="adm-panel-title"><Disc3 size={16} /> Source mix</h2></div>
                    <SourceDonut sources={ov.sources} />
                    <div style={{ marginTop: 16, display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <Pill kind="live">{ov.totals.live} live</Pill>
                      <Pill kind="hidden">{ov.totals.hidden} hidden</Pill>
                      <Pill kind="deleted">{ov.totals.deleted} deleted</Pill>
                      <Pill kind="official">{ov.totals.official} official</Pill>
                      {ov.totals.suspended > 0 && <Pill kind="suspended">{ov.totals.suspended} suspended</Pill>}
                    </div>
                  </section>
                </div>

                <div className="adm-grid-2">
                  <section className="adm-panel">
                    <div className="adm-panel-head">
                      <h2 className="adm-panel-title"><Star size={16} /> Top creators by plays</h2>
                      <button className="adm-btn sm" onClick={() => setTab("creators")}>See all <ChevronRight size={12} /></button>
                    </div>
                    {ov.topCreators.length === 0 ? (
                      <div className="adm-views-empty" style={{ padding: 20 }}>No creators yet.</div>
                    ) : (
                      <div className="adm-lead">
                        {ov.topCreators.map((c, i) => (
                          <button className="adm-lead-row" key={c.id} onClick={() => setDrawerCreator(c.id)}>
                            <span className={`adm-rank${i < 3 ? ` g${i + 1}` : ""}`}>{i + 1}</span>
                            <img src={avatarUrl(c.name, c.avatarPalette)} alt="" />
                            <span className="adm-lead-txt">
                              <strong>{c.name}{c.isOfficial && <Star size={11} color="var(--amber)" fill="var(--amber)" />}</strong>
                              <em>@{c.handle} · {c.stats.tracks} track{c.stats.tracks === 1 ? "" : "s"}</em>
                            </span>
                            <span className="adm-lead-num"><b>{nf(c.stats.plays)}</b><em>plays</em></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="adm-panel">
                    <div className="adm-panel-head"><h2 className="adm-panel-title"><Activity size={16} /> Live activity</h2></div>
                    {activity.length === 0 ? (
                      <div className="adm-views-empty" style={{ padding: 20 }}>Nothing has happened yet.</div>
                    ) : (
                      <div className="adm-feed">
                        {activity.map((a, i) => (
                          <Link className="adm-feed-row" key={i} href={a.href}>
                            <span className={`adm-feed-dot ${a.kind}`}>
                              {a.kind === "signup" ? <UserPlus size={11} /> : a.kind === "upload" ? <Music2 size={11} /> : <MessageCircle size={11} />}
                            </span>
                            <span className="adm-feed-txt">{a.label}<time>{timeAgo(a.at)}</time></span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="adm-panel">
                  <div className="adm-panel-head">
                    <h2 className="adm-panel-title"><Clock size={16} /> Freshest uploads</h2>
                    <button className="adm-btn sm" onClick={() => setTab("tracks")}>Moderate tracks <ChevronRight size={12} /></button>
                  </div>
                  {ov.recentTracks.length === 0 ? (
                    <div className="adm-views-empty" style={{ padding: 20 }}>The catalog is empty.</div>
                  ) : (
                    <div className="adm-table-wrap" style={{ border: "none", background: "transparent" }}>
                      <table className="adm-table" style={{ minWidth: 620 }}>
                        <thead><tr><th>Track</th><th>Source</th><th>State</th><th style={{ textAlign: "right" }}>Plays</th><th style={{ textAlign: "right" }}>Loves</th><th /></tr></thead>
                        <tbody>
                          {ov.recentTracks.map((t) => (
                            <tr key={t.id} onClick={() => setDrawerTrack(t)}>
                              <td>
                                <div className="adm-track-cell">
                                  <img className="adm-cover" src={coverUrl(t.coverSeed, t.coverPalette)} alt="" />
                                  <div className="adm-person-txt"><strong><span>{t.title}</span></strong><em>{t.artistName} · {timeAgo(t.createdAt)}</em></div>
                                </div>
                              </td>
                              <td><SourcePill source={t.source} /></td>
                              <td><Pill kind={t.state}>{t.state}</Pill></td>
                              <td className="adm-td-num">{nf(t.plays)}</td>
                              <td className="adm-td-num">{nf(t.likes)}</td>
                              <td><div className="adm-row-actions"><span className="adm-mini"><ChevronRight size={13} /></span></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </>
        )}

        {/* ═══ CREATORS ═══ */}
        {tab === "creators" && (
          <>
            <div className="adm-head">
              <div>
                <h1 className="adm-h1">Creator <span>roster</span></h1>
                <p className="adm-sub">Every account, their catalog, and their standing. Click a row for the full drill-down.</p>
              </div>
              <div className="adm-head-right">
                <button className="adm-btn" onClick={() => setTab("overview")}><ArrowLeft size={14} /> Back to overview</button>
                <ViewsMenu tab="creators" current={{ q: cQ, filter: cFilter, sort: cSort }} onApply={applyView} />
                <button className="adm-btn" onClick={() => loadCreators()} disabled={cLoading}><RefreshCw size={14} className={cLoading ? "adm-spin" : ""} /> Refresh</button>
              </div>
            </div>

            <div className="adm-toolbar">
              <div className="adm-chips">
                {[
                  { id: "all", label: "Everyone" }, { id: "active", label: "Publishing" }, { id: "empty", label: "No tracks" },
                  { id: "staff", label: "Staff" }, { id: "official", label: "Official" },
                  { id: "unverified", label: "Unverified" }, { id: "suspended", label: "Suspended" }
                ].map((f) => (
                  <button key={f.id} className={`adm-chip${cFilter === f.id ? " on" : ""}`} onClick={() => setCFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              <div className="adm-toolbar-right">
                <div className="adm-search" style={{ maxWidth: 250 }}>
                  <Search size={14} />
                  <input value={cQ} onChange={(e) => setCQ(e.target.value)} placeholder="Name, handle, email…" aria-label="Filter creators" style={{ height: 32, paddingRight: 12 }} />
                </div>
                <select className="adm-select" value={cSort} onChange={(e) => setCSort(e.target.value)} aria-label="Sort creators">
                  <option value="plays">Most plays</option>
                  <option value="tracks">Most tracks</option>
                  <option value="likes">Most loves</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            </div>

            {cLoading && creators.length === 0 ? <SkelRows n={8} /> : cErr ? (
              <Empty icon={<AlertTriangle size={24} />} title="Roster unavailable" body={cErr}
                actions={<button className="adm-btn primary" onClick={() => loadCreators()}><RefreshCw size={14} /> Retry</button>} />
            ) : creators.length === 0 ? (
              <Empty icon={<Users size={24} />} title="No creators match" body="Loosen the filter or clear the search to see the full roster."
                actions={<button className="adm-btn primary" onClick={() => { setCQ(""); setCFilter("all"); }}>Clear filters</button>} />
            ) : (
              <>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Creator</th><th>Standing</th><th>Joined</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setCSort("tracks")}>Tracks{cSort === "tracks" && <span className="sortmark">▾</span>}</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setCSort("plays")}>Plays{cSort === "plays" && <span className="sortmark">▾</span>}</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setCSort("likes")}>Loves{cSort === "likes" && <span className="sortmark">▾</span>}</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creators.map((c) => (
                        <tr key={c.id} className={c.suspended ? "dim" : ""} onClick={() => setDrawerCreator(c.id)}>
                          <td>
                            <div className="adm-person">
                              <img src={avatarUrl(c.name, c.avatarPalette)} alt="" />
                              <div className="adm-person-txt">
                                <strong>
                                  <span>{c.name}</span>
                                  {c.verified && <BadgeCheck size={13} color="var(--cyan)" />}
                                  {c.isOfficial && <Star size={12} color="var(--amber)" fill="var(--amber)" />}
                                </strong>
                                <em>@{c.handle}{c.email ? ` · ${c.email}` : ""}</em>
                              </div>
                            </div>
                          </td>
                          <td><RolePill c={c} /></td>
                          <td style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(c.createdAt)}</td>
                          <td className="adm-td-num">{nf(c.stats.tracks)}</td>
                          <td className="adm-td-num">{nf(c.stats.plays)}</td>
                          <td className="adm-td-num">{nf(c.stats.likes)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="adm-row-actions">
                              <Link className="adm-mini" href={`/profile/${c.handle}`} target="_blank" aria-label={`Open ${c.name}'s profile`}><ExternalLink size={12} /></Link>
                              {canDestroy && (
                                <>
                                  <button className="adm-mini" onClick={() => creatorAction(c, c.verified ? "unverify" : "verify")} aria-label={c.verified ? "Unverify" : "Verify"}><BadgeCheck size={12} /></button>
                                  <button className="adm-mini" onClick={() => creatorAction(c, c.isOfficial ? "unofficial" : "official")} aria-label="Toggle official"><Star size={12} /></button>
                                  <button className={`adm-mini ${c.suspended ? "good" : "danger"}`} onClick={() => creatorAction(c, c.suspended ? "restore" : "suspend")} aria-label={c.suspended ? "Reinstate" : "Suspend"}>
                                    {c.suspended ? <RotateCcw size={12} /> : <Ban size={12} />}
                                  </button>
                                </>
                              )}
                              <button className="adm-mini" onClick={() => setDrawerCreator(c.id)} aria-label="Open detail"><ChevronRight size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={cMeta.page} perPage={cMeta.perPage} total={cMeta.total} hasMore={cMeta.hasMore}
                  onPage={(p) => loadCreators(p)} onPerPage={(n) => setCMeta((m) => ({ ...m, perPage: n, page: 1 }))} />
              </>
            )}
          </>
        )}

        {/* ═══ TRACKS ═══ */}
        {tab === "tracks" && (
          <>
            <div className="adm-head">
              <div>
                <h1 className="adm-h1">Catalog <span>moderation</span></h1>
                <p className="adm-sub">Hide, publish, delete and restore. Every action is reversible from the toast.</p>
              </div>
              <div className="adm-head-right">
                <button className="adm-btn" onClick={() => setTab("overview")}><ArrowLeft size={14} /> Back to overview</button>
                <ViewsMenu tab="tracks" current={{ q: tQ, filter: tFilter, sort: tSort, source: tSource }} onApply={applyView} />
                <button className="adm-btn" onClick={() => loadTracks()} disabled={tLoading}><RefreshCw size={14} className={tLoading ? "adm-spin" : ""} /> Refresh</button>
              </div>
            </div>

            <div className="adm-toolbar">
              <div className="adm-chips">
                {[{ id: "all", label: "All" }, { id: "live", label: "Live" }, { id: "hidden", label: "Hidden" }, { id: "deleted", label: "Deleted" }].map((f) => (
                  <button key={f.id} className={`adm-chip${tFilter === f.id ? " on" : ""}`} onClick={() => setTFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              <div className="adm-chips">
                {[{ id: "all", label: "Any source" }, { id: "upload", label: "Uploads" }, { id: "synth", label: "Synth" }, { id: "youtube", label: "YouTube" }].map((f) => (
                  <button key={f.id} className={`adm-chip${tSource === f.id ? " on" : ""}`} onClick={() => setTSource(f.id)}>{f.label}</button>
                ))}
              </div>
              <div className="adm-toolbar-right">
                <div className="adm-search" style={{ maxWidth: 250 }}>
                  <Search size={14} />
                  <input value={tQ} onChange={(e) => setTQ(e.target.value)} placeholder="Title, artist, prompt…" aria-label="Filter tracks" style={{ height: 32, paddingRight: 12 }} />
                </div>
                <select className="adm-select" value={tSort} onChange={(e) => setTSort(e.target.value)} aria-label="Sort tracks">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="plays">Most plays</option>
                  <option value="likes">Most loves</option>
                  <option value="comments">Most comments</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>
            </div>

            {sel.size > 0 && (
              <div className="adm-bulk">
                <Check size={16} />
                <strong>{sel.size} selected</strong>
                <div className="adm-bulk-actions">
                  <button className="adm-btn sm" onClick={() => setSel(new Set())}>Clear</button>
                  {canDestroy ? (
                    <>
                      <button className="adm-btn sm good" onClick={() => bulk("publish")}><Eye size={12} /> Publish</button>
                      <button className="adm-btn sm" onClick={() => bulk("hide")}><EyeOff size={12} /> Hide</button>
                      <button className="adm-btn sm danger" onClick={() => bulk("delete")}><Trash2 size={12} /> Delete</button>
                    </>
                  ) : <span style={{ fontSize: 12, color: "var(--muted)" }}>Admin rights needed for bulk actions.</span>}
                </div>
              </div>
            )}

            {tLoading && tracks.length === 0 ? <SkelRows n={8} /> : tErr ? (
              <Empty icon={<AlertTriangle size={24} />} title="Catalog unavailable" body={tErr}
                actions={<button className="adm-btn primary" onClick={() => loadTracks()}><RefreshCw size={14} /> Retry</button>} />
            ) : tracks.length === 0 ? (
              <Empty icon={<Music2 size={24} />} title="No tracks match" body="Try a different state, source, or search term."
                actions={<button className="adm-btn primary" onClick={() => { setTQ(""); setTFilter("all"); setTSource("all"); }}>Clear filters</button>} />
            ) : (
              <>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 38 }}>
                          <input className="adm-check" type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all tracks on this page" />
                        </th>
                        <th>Track</th><th>Source</th><th>State</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setTSort("plays")}>Plays{tSort === "plays" && <span className="sortmark">▾</span>}</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setTSort("likes")}>Loves{tSort === "likes" && <span className="sortmark">▾</span>}</th>
                        <th className="sortable" style={{ textAlign: "right" }} onClick={() => setTSort("comments")}>Talk{tSort === "comments" && <span className="sortmark">▾</span>}</th>
                        <th>Published</th><th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.map((t) => (
                        <tr key={t.id} className={`${sel.has(t.id) ? "sel" : ""}${t.state === "deleted" ? " dim" : ""}`} onClick={() => setDrawerTrack(t)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input className="adm-check" type="checkbox" checked={sel.has(t.id)} onChange={() => toggleOne(t.id)} aria-label={`Select ${t.title}`} />
                          </td>
                          <td>
                            <div className="adm-track-cell">
                              <img className="adm-cover" src={coverUrl(t.coverSeed, t.coverPalette)} alt="" />
                              <div className="adm-person-txt"><strong><span>{t.title}</span></strong><em>{t.artistName} · @{t.artistHandle}</em></div>
                            </div>
                          </td>
                          <td><SourcePill source={t.source} /></td>
                          <td><Pill kind={t.state}>{t.state}</Pill></td>
                          <td className="adm-td-num">{nf(t.plays)}</td>
                          <td className="adm-td-num">{nf(t.likes)}</td>
                          <td className="adm-td-num">{nf(t.comments)}</td>
                          <td style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(t.createdAt)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="adm-row-actions">
                              <Link className="adm-mini" href={`/track/${t.publicId}`} target="_blank" aria-label={`Open ${t.title}`}><ExternalLink size={12} /></Link>
                              {canDestroy && t.state !== "deleted" && (
                                <button className="adm-mini" onClick={() => trackAction(t, t.state === "hidden" ? "publish" : "hide")} aria-label={t.state === "hidden" ? "Publish" : "Hide"}>
                                  {t.state === "hidden" ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                              )}
                              {canDestroy && (
                                <button className={`adm-mini ${t.state === "deleted" ? "good" : "danger"}`} onClick={() => trackAction(t, t.state === "deleted" ? "restore" : "delete")} aria-label={t.state === "deleted" ? "Restore" : "Delete"}>
                                  {t.state === "deleted" ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={tMeta.page} perPage={tMeta.perPage} total={tMeta.total} hasMore={tMeta.hasMore}
                  onPage={(p) => loadTracks(p)} onPerPage={(n) => setTMeta((m) => ({ ...m, perPage: n, page: 1 }))} />
              </>
            )}
          </>
        )}

        {/* ═══ REPORTS ═══ */}
        {tab === "reports" && (
          <>
            <div className="adm-head">
              <div>
                <h1 className="adm-h1">Report <span>queue</span></h1>
                <p className="adm-sub">Community flags for copyright, abuse, and policy problems.</p>
              </div>
              <div className="adm-head-right">
                <button className="adm-btn" onClick={() => setTab("overview")}><ArrowLeft size={14} /> Back to overview</button>
                <Link className="adm-btn" href="/legal/dmca" target="_blank"><Flag size={14} /> Takedown policy</Link>
                <button className="adm-btn" onClick={loadReports} disabled={rLoading}><RefreshCw size={14} className={rLoading ? "adm-spin" : ""} /> Refresh</button>
              </div>
            </div>

            {rLoading ? <SkelRows n={5} /> : rErr ? (
              <Empty icon={<Inbox size={24} />} title="Queue unavailable" body={rErr}
                actions={<button className="adm-btn primary" onClick={loadReports}><RefreshCw size={14} /> Retry</button>} />
            ) : reports.length === 0 ? (
              <Empty icon={<Check size={24} />} title="Queue is clear" body="No open reports. The community is behaving itself — for now."
                actions={<button className="adm-btn primary" onClick={() => setTab("tracks")}><Music2 size={14} /> Audit the catalog</button>} />
            ) : (
              reports.map((r) => (
                <article className="adm-report" key={r.id}>
                  <div className="adm-report-head">
                    <Pill kind={String(r.status ?? "open") === "resolved" ? "live" : "hidden"}>{String(r.status ?? "open")}</Pill>
                    <strong>{r.target_label ?? (r.track_id ? "Track report" : r.comment_id ? "Comment report" : "Report")}</strong>
                    {r.reason && <Pill kind="admin">{r.reason}</Pill>}
                  </div>
                  <p className="adm-report-body">{r.details ?? "No additional detail was supplied with this report."}</p>
                  <div className="adm-report-foot">
                    {r.track_id && <Link className="adm-btn sm" href={`/track/${r.track_id}`} target="_blank"><ExternalLink size={12} /> Open track</Link>}
                    <button className="adm-btn sm" onClick={() => { setTFilter("all"); setTQ(""); setTab("tracks"); }}><Music2 size={12} /> Catalog</button>
                    {r.created_at && <time>{timeAgo(Date.parse(r.created_at))}</time>}
                  </div>
                </article>
              ))
            )}
          </>
        )}

        {/* ═══ SYSTEM ═══ */}
        {tab === "system" && <SystemTab />}
      </main>

      <nav className="adm-tabs-mobile" aria-label="Console sections">
        {TABS.map((t) => (
          <button key={t.id} className={`adm-tab-m${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>

      {drawerCreator && (
        <CreatorDrawer
          id={drawerCreator} canDestroy={canDestroy}
          onClose={() => { setDrawerCreator(null); if (tab === "creators") void loadCreators(); }}
          onCreatorAction={creatorAction} onTrackAction={trackAction}
        />
      )}
      {drawerTrack && <TrackDrawer track={drawerTrack} canDestroy={canDestroy} onClose={() => setDrawerTrack(null)} onAction={trackAction} />}

      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.run(); }}
        title={confirm?.title ?? ""} body={<p>{confirm?.body ?? ""}</p>}
        confirmLabel={confirm?.label ?? "Confirm"}
      />
    </>
  );
}