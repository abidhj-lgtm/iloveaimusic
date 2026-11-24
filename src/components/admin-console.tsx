"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, Flag, Search, X, EyeOff, Trash2, RotateCcw, CheckCircle2, Clock,
  AlertTriangle, Users, Activity, Play, Pause, Loader2, ChevronRight, Scale, Wand2, Gavel
} from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { coverUrl, avatarUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { timeAgo, formatCount } from "@/lib/utils";
import { Spinner } from "./ui";
import { LICENSES, AI_TOOLS } from "@/lib/rights-options";

type Tab = "queue" | "artists" | "activity";
type View = "open" | "copyright" | "abuse" | "resolved" | "all";

interface Report {
  id: string; reason: string; reasonLabel: string; details: string; status: string;
  createdAt: number; resolvedAt: number | null; resolutionNote: string;
  track: { id: string; title: string; coverSeed: string; coverPalette: number; source: string; youtubeId?: string; status: string; plays: number } | null;
  owner: { id: string; name: string; handle: string; avatarPalette: number; strikes: number } | null;
  reporter: { id: string; name: string; handle: string; avatarPalette: number } | null;
  commentText?: string;
  rights: { attested: boolean; license: string; ai_tool: string; human_contribution: string; explicit: boolean; third_party_samples: boolean } | null;
}
interface Payload {
  reports: Report[];
  stats: Record<string, number>;
  artists: { id: string; name: string; handle: string; avatarPalette: number; strikes: number; tracks: number; hidden: number }[];
  activity: { id: string; batchId: string; action: string; targetType: string; targetId: string; note: string; actor: string; createdAt: number; undone: boolean }[];
  role: string;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "open", label: "Open queue" },
  { id: "copyright", label: "Copyright" },
  { id: "abuse", label: "Spam & abuse" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "Everything" }
];

const REASON_TONE: Record<string, string> = {
  copyright: "tone-red", spam: "tone-amber", hate: "tone-red",
  explicit_mislabel: "tone-amber", broken_media: "tone-cyan",
  impersonation: "tone-violet", other: "tone-slate"
};

export function AdminConsole() {
  const toast = useToast();
  const player = usePlayer();
  const { state } = useStore();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("queue");
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "reason">("new");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { credentials: "same-origin", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { setError(j?.error ?? "Could not load the console."); return; }
      setError(""); setData(j as Payload);
    } catch { setError("Can't reach the server."); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ilistenai:modview");
      if (saved) { const p = JSON.parse(saved); if (p.view) setView(p.view); if (p.sort) setSort(p.sort); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("ilistenai:modview", JSON.stringify({ view, sort })); } catch { /* ignore */ }
  }, [view, sort]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.reports;
    if (view === "open") list = list.filter((r) => r.status === "open" || r.status === "reviewing");
    if (view === "copyright") list = list.filter((r) => r.reason === "copyright");
    if (view === "abuse") list = list.filter((r) => ["spam", "hate", "impersonation", "explicit_mislabel"].includes(r.reason));
    if (view === "resolved") list = list.filter((r) => r.status === "actioned" || r.status === "dismissed");
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((r) =>
        r.details.toLowerCase().includes(n) || r.reasonLabel.toLowerCase().includes(n) ||
        (r.track?.title.toLowerCase().includes(n) ?? false) ||
        (r.owner?.name.toLowerCase().includes(n) ?? false) ||
        (r.reporter?.name.toLowerCase().includes(n) ?? false));
    }
    const s = [...list];
    if (sort === "new") s.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "old") s.sort((a, b) => a.createdAt - b.createdAt);
    if (sort === "reason") s.sort((a, b) => a.reasonLabel.localeCompare(b.reasonLabel) || b.createdAt - a.createdAt);
    return s;
  }, [data, view, q, sort]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)));
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const act = async (action: string, opts: { reportIds?: string[]; trackIds?: string[]; strikeUserId?: string; note?: string; batchId?: string } = {}) => {
    setBusy(true);
    try {
      const res = await fetch("/api/moderation", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action, note: opts.note ?? note, reportIds: opts.reportIds ?? [], trackIds: opts.trackIds ?? [], commentIds: [], strikeUserId: opts.strikeUserId, batchId: opts.batchId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { toast.push({ kind: "err", msg: j?.error ?? "Action failed." }); return; }
      await load();
      setSelected(new Set());
      setNote("");
      setDrawer(null);
      if (action === "undo") { toast.push({ kind: "ok", msg: `Reverted ${j.affected} change${j.affected === 1 ? "" : "s"}.` }); return; }
      toast.push({
        kind: "ok",
        msg: `${j.affected} item${j.affected === 1 ? "" : "s"} ${action === "dismiss" ? "dismissed" : action === "hide" ? "hidden" : action === "remove" ? "removed" : action === "restore" ? "restored" : action === "strike" ? "struck" : "updated"}.`,
        action: { label: "Undo", fn: () => { void act("undo", { batchId: j.batchId }); } }
      });
    } catch { toast.push({ kind: "err", msg: "Can't reach the server." }); }
    finally { setBusy(false); }
  };

  const bulk = (action: string) => {
    const rows = filtered.filter((r) => selected.has(r.id));
    const trackIds = [...new Set(rows.map((r) => r.track?.id).filter(Boolean) as string[])];
    void act(action, { reportIds: rows.map((r) => r.id), trackIds: action === "hide" || action === "remove" || action === "restore" ? trackIds : [] });
  };

  if (error) {
    return (
      <div className="mod-gate">
        <span className="mod-gate-icon"><ShieldCheck size={30} /></span>
        <h1>Moderator access required</h1>
        <p>{error}</p>
        <p className="mod-gate-hint">The demo studio account (<strong>aria@gmail.com</strong> / <code>demo1234</code>) has moderator rights, so you can explore the console immediately.</p>
        <div className="mod-gate-actions">
          <Link href="/login?next=%2Fadmin" className="btn btn-brand">Log in as moderator</Link>
          <Link href="/" className="btn btn-ghost">Back to the feed</Link>
        </div>
      </div>
    );
  }

  if (!data) return <div className="mod-loading"><Spinner size={22} /><span>Opening the moderation console…</span></div>;

  const s = data.stats;

  return (
    <div className="mod">
      <header className="mod-head">
        <div>
          <span className="mod-eyebrow"><Gavel size={14} />Staff console · signed in as {data.role}</span>
          <h1>Moderation</h1>
          <p>Every action here changes what the public sees. Destructive actions are reversible for a few seconds, and everything is written to the audit log.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RotateCcw size={14} />Refresh</button>
      </header>

      <div className="mod-stats">
        {[
          { k: "open", label: "Open reports", tone: "red", icon: <Flag size={15} /> },
          { k: "reviewing", label: "In review", tone: "amber", icon: <Clock size={15} /> },
          { k: "copyright", label: "Copyright live", tone: "red", icon: <Scale size={15} /> },
          { k: "hiddenTracks", label: "Hidden tracks", tone: "violet", icon: <EyeOff size={15} /> },
          { k: "flaggedArtists", label: "Flagged artists", tone: "amber", icon: <AlertTriangle size={15} /> },
          { k: "provenanceGaps", label: "Provenance gaps", tone: "cyan", icon: <Wand2 size={15} /> },
          { k: "resolvedToday", label: "Resolved 24h", tone: "lime", icon: <CheckCircle2 size={15} /> },
          { k: "totalReports", label: "All-time reports", tone: "slate", icon: <Activity size={15} /> }
        ].map((c) => (
          <div key={c.k} className={`mod-stat tone-${c.tone}`}>
            <span className="mod-stat-icon">{c.icon}</span>
            <strong>{s[c.k] ?? 0}</strong>
            <em>{c.label}</em>
          </div>
        ))}
      </div>

      <div className="mod-tabs" role="tablist">
        {([["queue", "Report queue", <Flag key="a" size={15} />], ["artists", "Artists & strikes", <Users key="b" size={15} />], ["activity", "Activity log", <Activity key="c" size={15} />]] as const).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`mod-tab${tab === id ? " on" : ""}`} onClick={() => setTab(id as Tab)}>{icon}{label}</button>
        ))}
      </div>

      {tab === "queue" && (
        <>
          <div className="mod-toolbar">
            <div className="mod-views">
              {VIEWS.map((v) => (
                <button key={v.id} className={`chip${view === v.id ? " active" : ""}`} onClick={() => { setView(v.id); setSelected(new Set()); }}>{v.label}</button>
              ))}
            </div>
            <div className="mod-search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports, tracks, artists…" aria-label="Search reports" />
              {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as never)} aria-label="Sort reports">
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="reason">By reason</option>
            </select>
          </div>

          <div className="mod-bulkbar">
            <label className="mod-check">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all reports" />
              <span className="trust-check">{allChecked && <CheckCircle2 size={13} />}</span>
              <span>{selected.size ? `${selected.size} selected` : `${filtered.length} report${filtered.length === 1 ? "" : "s"}`}</span>
            </label>
            {selected.size > 0 && (
              <div className="mod-bulk-actions">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulk("review")}><Clock size={14} />Mark reviewing</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulk("hide")}><EyeOff size={14} />Hide tracks</button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => bulk("remove")}><Trash2 size={14} />Remove tracks</button>
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => bulk("dismiss")}><CheckCircle2 size={14} />Dismiss</button>
                <button className="icon-btn" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X size={15} /></button>
              </div>
            )}
            {busy && <span className="mod-busy"><Loader2 size={14} className="spin" />Working…</span>}
          </div>

          {filtered.length === 0 ? (
            <div className="mod-empty"><CheckCircle2 size={26} /><h3>Queue clear</h3><p>Nothing matches this view. Try “Everything” to see resolved history.</p></div>
          ) : (
            <ul className="mod-list">
              {filtered.map((r) => {
                const cover = r.track ? (r.track.source === "youtube" && r.track.youtubeId ? ytThumb(r.track.youtubeId) : coverUrl(r.track.coverSeed, r.track.coverPalette)) : null;
                const isPlaying = r.track && player.track?.id === r.track.id && player.playing;
                return (
                  <li key={r.id} className={`mod-row${selected.has(r.id) ? " picked" : ""}`}>
                    <label className="mod-check">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select report on ${r.track?.title ?? "comment"}`} />
                      <span className="trust-check">{selected.has(r.id) && <CheckCircle2 size={13} />}</span>
                    </label>
                    {cover && <img className="mod-cover" src={cover} alt="" loading="lazy" />}
                    <div className="mod-row-main">
                      <div className="mod-row-top">
                        <span className={`mod-reason ${REASON_TONE[r.reason] ?? "tone-slate"}`}>{r.reasonLabel}</span>
                        <span className={`mod-status st-${r.status}`}>{r.status}</span>
                        {r.owner && r.owner.strikes > 0 && <span className="mod-strike"><AlertTriangle size={11} />{r.owner.strikes} strike{r.owner.strikes === 1 ? "" : "s"}</span>}
                        <span className="mod-age">{timeAgo(r.createdAt)}</span>
                      </div>
                      <strong className="mod-target">{r.track?.title ?? "Comment report"}</strong>
                      <p className="mod-detail">{r.details}</p>
                      <div className="mod-meta">
                        {r.owner && <span>by <Link href={`/profile/${r.owner.handle}`}>{r.owner.name}</Link></span>}
                        {r.reporter && <span>reported by {r.reporter.name}</span>}
                        {r.track && <span>{formatCount(r.track.plays)} plays</span>}
                        {r.rights && <span className={r.rights.attested ? "ok" : "warn"}>{r.rights.attested ? "provenance ✓" : "provenance missing"}</span>}
                      </div>
                    </div>
                    <div className="mod-row-actions">
                      {r.track && (
                        <button className="p-play sm" aria-label="Play target"
                          onClick={() => {
                            const t = state.tracks.find((x) => x.id === r.track!.id);
                            if (!t) { toast.push({ kind: "info", msg: "That track is not in the public feed right now." }); return; }
                            player.track?.id === t.id ? player.toggle() : player.playTrack(t, [t.id]);
                          }}>
                          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => { setDrawer(r); setNote(r.resolutionNote); }}>Review<ChevronRight size={14} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "artists" && (
        <div className="mod-artists">
          {data.artists.map((a) => (
            <div key={a.id} className={`mod-artist${a.strikes > 0 ? " flagged" : ""}`}>
              <img src={avatarUrl(a.name, a.avatarPalette)} alt="" width={44} height={44} />
              <div>
                <Link href={`/profile/${a.handle}`}><strong>{a.name}</strong></Link>
                <em>@{a.handle} · {a.tracks} track{a.tracks === 1 ? "" : "s"}{a.hidden ? ` · ${a.hidden} hidden` : ""}</em>
              </div>
              <span className={`mod-strike-count${a.strikes ? " on" : ""}`}>{a.strikes} strike{a.strikes === 1 ? "" : "s"}</span>
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void act("strike", { strikeUserId: a.id, note: `Policy strike issued from the artists panel.` })}>
                <AlertTriangle size={14} />Issue strike
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className="mod-activity">
          {data.activity.length === 0 ? (
            <div className="mod-empty"><Activity size={26} /><h3>No actions yet</h3><p>Moderation decisions will appear here with a full audit trail.</p></div>
          ) : data.activity.map((a) => (
            <div key={a.id} className={`mod-act${a.undone ? " undone" : ""}`}>
              <span className={`mod-act-dot act-${a.action}`} />
              <div>
                <strong>{a.action}</strong> on {a.targetType} <code>{a.targetId.slice(0, 8)}</code>
                {a.note && <p>{a.note}</p>}
                <em>{a.actor} · {timeAgo(a.createdAt)}{a.undone ? " · reverted" : ""}</em>
              </div>
              {!a.undone && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("undo", { batchId: a.batchId })}><RotateCcw size={13} />Undo</button>}
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(null); }}>
          <aside className="drawer mod-drawer" role="dialog" aria-modal="true" aria-label="Report detail">
            <div className="drawer-head">
              <h3>Report detail</h3>
              <button className="icon-btn" onClick={() => setDrawer(null)} aria-label="Close"><X size={19} /></button>
            </div>
            <div className="mod-drawer-body">
              <div className="mod-drawer-top">
                <span className={`mod-reason ${REASON_TONE[drawer.reason] ?? "tone-slate"}`}>{drawer.reasonLabel}</span>
                <span className={`mod-status st-${drawer.status}`}>{drawer.status}</span>
                <span className="mod-age">{timeAgo(drawer.createdAt)}</span>
              </div>

              {drawer.track && (
                <div className="mod-drawer-target">
                  <img src={drawer.track.source === "youtube" && drawer.track.youtubeId ? ytThumb(drawer.track.youtubeId) : coverUrl(drawer.track.coverSeed, drawer.track.coverPalette)} alt="" />
                  <div>
                    <Link href={`/track/${drawer.track.id}`} onClick={() => setDrawer(null)}><strong>{drawer.track.title}</strong></Link>
                    <em>{drawer.owner?.name} · currently {drawer.track.status}</em>
                  </div>
                </div>
              )}

              {drawer.commentText && <blockquote className="mod-quote">{drawer.commentText}</blockquote>}

              <section className="mod-drawer-sec">
                <h4>Reporter statement</h4>
                <p>{drawer.details}</p>
                {drawer.reporter && <em>Filed by {drawer.reporter.name} (@{drawer.reporter.handle})</em>}
              </section>

              <section className="mod-drawer-sec">
                <h4>Provenance on record</h4>
                {drawer.rights ? (
                  <ul className="mod-facts">
                    <li><span>Attested</span><strong className={drawer.rights.attested ? "ok" : "warn"}>{drawer.rights.attested ? "Yes" : "No"}</strong></li>
                    <li><span>Licence</span><strong>{LICENSES.find((l) => l.id === drawer.rights!.license)?.label ?? drawer.rights.license}</strong></li>
                    <li><span>AI tool</span><strong>{AI_TOOLS.find((t) => t.id === drawer.rights!.ai_tool)?.label ?? drawer.rights.ai_tool}</strong></li>
                    <li><span>Explicit</span><strong>{drawer.rights.explicit ? "Yes" : "No"}</strong></li>
                    <li><span>Third-party samples</span><strong>{drawer.rights.third_party_samples ? "Declared" : "None declared"}</strong></li>
                    {drawer.rights.human_contribution && <li className="wide"><span>Human contribution</span><strong>{drawer.rights.human_contribution}</strong></li>}
                  </ul>
                ) : <p className="warn">No provenance has been declared for this track.</p>}
              </section>

              <div className="field">
                <label className="label" htmlFor="mod-note">Resolution note</label>
                <textarea id="mod-note" className="textarea" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the decision. This is stored in the audit log and shown to the reporter." />
              </div>

              <div className="mod-drawer-actions">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("review", { reportIds: [drawer.id] })}><Clock size={14} />Mark reviewing</button>
                {drawer.track && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("hide", { reportIds: [drawer.id], trackIds: [drawer.track!.id] })}><EyeOff size={14} />Hide track</button>}
                {drawer.track && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void act("remove", { reportIds: [drawer.id], trackIds: [drawer.track!.id] })}><Trash2 size={14} />Remove track</button>}
                {drawer.track && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void act("restore", { reportIds: [drawer.id], trackIds: [drawer.track!.id] })}><RotateCcw size={14} />Restore</button>}
                {drawer.owner && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void act("strike", { reportIds: [drawer.id], strikeUserId: drawer.owner!.id })}><AlertTriangle size={14} />Strike artist</button>}
                <button className="btn btn-brand btn-sm" disabled={busy} onClick={() => void act("dismiss", { reportIds: [drawer.id] })}><CheckCircle2 size={14} />Dismiss report</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}