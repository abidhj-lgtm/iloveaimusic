"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, EyeOff, Trash2, RotateCcw, Music2, Users, ArrowLeft, Loader2, ShieldCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/lib/store";
import { coverUrl, avatarUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { timeAgo, formatCount, formatDuration } from "@/lib/utils";
import { Spinner } from "./ui";

interface TrackRow {
  id: string; title: string; status: string; source: string; youtubeId?: string;
  coverSeed: string; coverPalette: number; plays: number; likes: number; comments: number;
  duration: number | null; createdAt: number; attested: boolean; license: string; openReports: number;
  owner: { id: string; name: string; handle: string; avatarPalette: number } | null;
}
interface UserRow {
  id: string; name: string; handle: string; email: string; avatarPalette: number;
  provider: string; role: string; verified: boolean; closed: boolean; createdAt: number;
  tracks: number; strikes: number;
}

export function AdminCatalog() {
  const toast = useToast();
  const [kind, setKind] = useState<"tracks" | "users">("tracks");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("new");
  const [rows, setRows] = useState<(TrackRow | UserRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (nextCursor?: string | null, append = false) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ kind, limit: "25", sort });
      if (q.trim()) p.set("q", q.trim());
      if (kind === "tracks") p.set("status", status);
      if (nextCursor) p.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/catalog?${p}`, { credentials: "same-origin", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { setError(j?.error ?? "Could not load."); setRows([]); return; }
      setError("");
      setTotal(j.total ?? 0);
      setCursor(j.nextCursor ?? null);
      setRows((prev) => append ? [...prev, ...j.rows] : j.rows);
    } catch { setError("Can't reach the server."); }
    finally { setLoading(false); }
  }, [kind, q, sort, status]);

  useEffect(() => { setPicked(new Set()); void load(null, false); }, [load]);

  const trackRows = kind === "tracks" ? (rows as TrackRow[]) : [];
  const userRows = kind === "users" ? (rows as UserRow[]) : [];
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const act = async (action: string, ids: string[]) => {
    setBusy(true);
    try {
      const res = await fetch("/api/moderation", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action, trackIds: ids, reportIds: [], commentIds: [], note: `Bulk ${action} from catalog inventory.` })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { toast.push({ kind: "err", msg: j?.error ?? "Action failed." }); return; }
      setPicked(new Set());
      await load(null, false);
      toast.push({
        kind: "ok", msg: `${j.affected} track${j.affected === 1 ? "" : "s"} updated.`,
        action: {
          label: "Undo", fn: () => {
            void fetch("/api/moderation", {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
              body: JSON.stringify({ action: "undo", batchId: j.batchId, trackIds: [], reportIds: [], commentIds: [], note: "" })
            }).then(() => load(null, false)).then(() => toast.push({ kind: "ok", msg: "Reverted." }));
          }
        }
      });
    } catch { toast.push({ kind: "err", msg: "Can't reach the server." }); }
    finally { setBusy(false); }
  };

  const stats = useMemo(() => ({
    hidden: trackRows.filter((t) => t.status === "hidden" || t.status === "removed").length,
    unattested: trackRows.filter((t) => !t.attested).length,
    reported: trackRows.filter((t) => t.openReports > 0).length
  }), [trackRows]);

  if (error) {
    return (
      <div className="mod-gate">
        <span className="mod-gate-icon"><ShieldCheck size={30} /></span>
        <h1>Moderator access required</h1>
        <p>{error}</p>
        <div className="mod-gate-actions">
          <Link href="/admin" className="btn btn-brand">Report queue</Link>
          <Link href="/" className="btn btn-ghost">Back to the feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mod">
      <header className="mod-head">
        <div>
          <span className="mod-eyebrow"><Music2 size={14} />Staff inventory</span>
          <h1>Catalog &amp; accounts</h1>
          <p>Every track and account on the server, with provenance status and open report counts. Bulk actions are reversible.</p>
        </div>
        <Link href="/admin" className="btn btn-ghost btn-sm"><ArrowLeft size={14} />Report queue</Link>
      </header>

      <div className="mod-tabs" role="tablist">
        <button role="tab" aria-selected={kind === "tracks"} className={`mod-tab${kind === "tracks" ? " on" : ""}`} onClick={() => setKind("tracks")}><Music2 size={15} />Tracks</button>
        <button role="tab" aria-selected={kind === "users"} className={`mod-tab${kind === "users" ? " on" : ""}`} onClick={() => setKind("users")}><Users size={15} />Accounts</button>
      </div>

      <div className="mod-toolbar">
        <div className="mod-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "tracks" ? "Search titles, prompts, artists…" : "Search names, handles, emails…"} aria-label="Search inventory" />
          {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
        </div>
        {kind === "tracks" && (
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
            <option value="removed">Removed</option>
            <option value="draft">Draft</option>
            <option value="failed">Failed</option>
          </select>
        )}
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Newest</option>
          <option value="old">Oldest</option>
          {kind === "tracks" ? <option value="played">Most played</option> : <option value="name">By name</option>}
        </select>
        <span className="mod-total">{total} total</span>
      </div>

      {kind === "tracks" && (
        <>
          <div className="mod-stats compact">
            <div className="mod-stat tone-violet"><span className="mod-stat-icon"><EyeOff size={15} /></span><strong>{stats.hidden}</strong><em>hidden on this page</em></div>
            <div className="mod-stat tone-amber"><span className="mod-stat-icon"><AlertTriangle size={15} /></span><strong>{stats.unattested}</strong><em>provenance missing</em></div>
            <div className="mod-stat tone-red"><span className="mod-stat-icon"><AlertTriangle size={15} /></span><strong>{stats.reported}</strong><em>with open reports</em></div>
          </div>

          <div className="mod-bulkbar">
            <label className="mod-check">
              <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all tracks" />
              <span className="trust-check">{allPicked && <ShieldCheck size={13} />}</span>
              <span>{picked.size ? `${picked.size} selected` : `${rows.length} shown`}</span>
            </label>
            {picked.size > 0 && (
              <div className="mod-bulk-actions">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("hide", [...picked])}><EyeOff size={14} />Hide</button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void act("remove", [...picked])}><Trash2 size={14} />Remove</button>
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void act("restore", [...picked])}><RotateCcw size={14} />Restore</button>
                <button className="icon-btn" onClick={() => setPicked(new Set())} aria-label="Clear selection"><X size={15} /></button>
              </div>
            )}
            {busy && <span className="mod-busy"><Loader2 size={14} className="spin" />Working…</span>}
          </div>

          <ul className="mod-list">
            {trackRows.map((t) => (
              <li key={t.id} className={`mod-row${picked.has(t.id) ? " picked" : ""}`}>
                <label className="mod-check">
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.title}`} />
                  <span className="trust-check">{picked.has(t.id) && <ShieldCheck size={13} />}</span>
                </label>
                <img className="mod-cover" src={t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : coverUrl(t.coverSeed, t.coverPalette)} alt="" loading="lazy" />
                <div className="mod-row-main">
                  <div className="mod-row-top">
                    <span className={`mod-status st-${t.status === "published" ? "actioned" : t.status === "hidden" ? "reviewing" : "open"}`}>{t.status}</span>
                    {t.openReports > 0 && <span className="mod-strike"><AlertTriangle size={11} />{t.openReports} open</span>}
                    <span className={`mod-meta ${t.attested ? "ok" : "warn"}`}>{t.attested ? "provenance ✓" : "provenance missing"}</span>
                    <span className="mod-age">{timeAgo(t.createdAt)}</span>
                  </div>
                  <strong className="mod-target">{t.title}</strong>
                  <div className="mod-meta">
                    {t.owner && <span>by <Link href={`/profile/${t.owner.handle}`}>{t.owner.name}</Link></span>}
                    <span>{formatCount(t.plays)} plays</span>
                    <span>{formatCount(t.likes)} likes</span>
                    <span>{t.comments} comments</span>
                    {t.duration ? <span>{formatDuration(t.duration)}</span> : null}
                    <span>{t.license.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="mod-row-actions">
                  <Link href={`/track/${t.id}`} className="btn btn-ghost btn-sm">Open<ChevronRight size={14} /></Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {kind === "users" && (
        <div className="mod-artists">
          {userRows.map((u) => (
            <div key={u.id} className={`mod-artist${u.strikes > 0 ? " flagged" : ""}${u.closed ? " closed" : ""}`}>
              <img src={avatarUrl(u.name, u.avatarPalette)} alt="" width={44} height={44} />
              <div>
                <Link href={`/profile/${u.handle}`}><strong>{u.name}</strong></Link>
                <em>@{u.handle} · {u.tracks} track{u.tracks === 1 ? "" : "s"} · {u.provider} · {u.role}{u.closed ? " · closed" : u.verified ? " · verified" : " · unverified"}</em>
                <em className="mod-email">{u.email}</em>
              </div>
              <span className={`mod-strike-count${u.strikes ? " on" : ""}`}>{u.strikes} strike{u.strikes === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="mod-loading"><Spinner size={20} /><span>Loading inventory…</span></div>}
      {!loading && rows.length === 0 && <div className="mod-empty"><Music2 size={26} /><h3>Nothing here</h3><p>No records match this filter.</p></div>}
      {!loading && cursor && (
        <div className="seo-pager">
          <button className="btn btn-brand btn-sm" onClick={() => void load(cursor, true)}>Load 25 more<ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}