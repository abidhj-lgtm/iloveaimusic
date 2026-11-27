"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListMusic, ListPlus, Plus, Check, Music2, Loader2, X } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { coverUrl } from "@/lib/covers";

interface PlaylistLite {
  id: string; title: string; description: string;
  cover_seed: string; cover_palette: number; track_count: number; is_public: boolean;
}

export function PlaylistCard({ p }: { p: PlaylistLite }) {
  return (
    <Link href={`/playlist/${p.id}`} className="pl-card">
      <span className="pl-cover">
        <img src={coverUrl(p.cover_seed || p.id, p.cover_palette)} alt="" loading="lazy" />
        <span className="pl-cover-count"><Music2 size={14} />{p.track_count}</span>
      </span>
      <span className="pl-meta">
        <strong>{p.title}</strong>
        <em>{p.track_count} track{p.track_count === 1 ? "" : "s"} · {p.is_public ? "Public" : "Private"}</em>
      </span>
    </Link>
  );
}

export function AddToPlaylistModal({ trackId, title, open, onClose }: {
  trackId: string; title: string; open: boolean; onClose: () => void;
}) {
  const { currentUser } = useStore();
  const toast = useToast();
  const [items, setItems] = useState<PlaylistLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists", { credentials: "same-origin", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (d?.ok) setItems(d.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (open) { void load(); setNewTitle(""); } }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const addTo = async (playlistId: string) => {
    setBusyId(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId })
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok) {
        toast.push({ kind: "ok", msg: d.alreadyThere ? "Already in that playlist." : "Added to playlist." });
        setItems((p) => p.map((x) => x.id === playlistId ? { ...x, track_count: x.track_count + (d.alreadyThere ? 0 : 1) } : x));
        if (!d.alreadyThere) onClose();
      } else toast.push({ kind: "err", msg: d?.error ?? "Couldn't add the track." });
    } catch { toast.push({ kind: "err", msg: "Couldn't reach the server." }); }
    setBusyId(null);
  };

  const create = async () => {
    const t = newTitle.trim();
    if (!t) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t })
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok && d.playlist) {
        toast.push({ kind: "ok", msg: `Created “${d.playlist.title}”.` });
        setNewTitle("");
        await load();
        await addTo(d.playlist.id);
      } else toast.push({ kind: "err", msg: d?.error ?? "Couldn't create the playlist." });
    } catch { toast.push({ kind: "err", msg: "Couldn't reach the server." }); }
    setCreating(false);
  };

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add to playlist" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <h3>Add to playlist</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <p className="pl-target">Adding <strong>{title}</strong></p>

        <div className="pl-create-row">
          <input
            className="input" value={newTitle} maxLength={120}
            placeholder="New playlist name…"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
            aria-label="New playlist name"
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void create()} disabled={creating || !newTitle.trim()}>
            {creating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Create
          </button>
        </div>

        <div className="pl-list">
          {loading ? (
            <div className="pl-loading"><Loader2 size={20} className="spin" /> Loading your playlists…</div>
          ) : items.length === 0 ? (
            <div className="pl-empty">No playlists yet. Create your first one above.</div>
          ) : (
            items.map((p) => (
              <button key={p.id} type="button" className="pl-row" onClick={() => void addTo(p.id)} disabled={busyId === p.id}>
                <img src={coverUrl(p.cover_seed || p.id, p.cover_palette)} alt="" className="pl-row-cover" />
                <span className="pl-row-info">
                  <strong>{p.title}</strong>
                  <em>{p.track_count} track{p.track_count === 1 ? "" : "s"}</em>
                </span>
                <span className="pl-row-act">{busyId === p.id ? <Loader2 size={16} className="spin" /> : <ListPlus size={16} />}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function AddToPlaylistButton({ trackId, title }: { trackId: string; title: string }) {
  const { currentUser } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!currentUser) {
    return (
      <button type="button" className="btn btn-ghost icon-label" onClick={() => toast.push({ kind: "info", msg: "Log in to build playlists." })}>
        <ListMusic size={17} /><span>Playlist</span>
      </button>
    );
  }
  return (
    <>
      <button type="button" className="btn btn-ghost icon-label" onClick={() => setOpen(true)} aria-label="Add to playlist">
        <ListMusic size={17} /><span>Playlist</span>
      </button>
      <AddToPlaylistModal trackId={trackId} title={title} open={open} onClose={() => setOpen(false)} />
    </>
  );
}