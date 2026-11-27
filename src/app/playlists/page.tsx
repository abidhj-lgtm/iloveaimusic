"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ListMusic, Loader2, Plus } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { PlaylistCard } from "@/components/playlist-ui";

interface PlaylistLite {
  id: string; title: string; description: string;
  cover_seed: string; cover_palette: number; track_count: number; is_public: boolean;
}

export default function PlaylistsPage() {
  const { currentUser } = useStore();
  const toast = useToast();
  const [items, setItems] = useState<PlaylistLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
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

  useEffect(() => { if (currentUser) void load(); }, [currentUser, load]);

  const create = async () => {
    const t = name.trim();
    if (!t) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t })
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok) { toast.push({ kind: "ok", msg: `Created “${d.playlist.title}”.` }); setName(""); await load(); }
      else toast.push({ kind: "err", msg: d?.error ?? "Couldn't create the playlist." });
    } catch { toast.push({ kind: "err", msg: "Couldn't reach the server." }); }
    setCreating(false);
  };

  if (!currentUser) {
    return (
      <div className="empty">
        <div className="empty-icon"><ListMusic size={30} /></div>
        <h3>Log in to build playlists</h3>
        <p>Curate the tracks you love into collections anyone can follow.</p>
      </div>
    );
  }

  return (
    <div className="page-head-col">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your playlists</h1>
          <p className="page-sub">Collections of the music you want to keep close.</p>
        </div>
      </div>

      <div className="pl-create-bar">
        <input
          className="input" value={name} maxLength={120} placeholder="Name a new playlist…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
          aria-label="New playlist name"
        />
        <button type="button" className="btn btn-brand" onClick={() => void create()} disabled={creating || !name.trim()}>
          {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Create playlist
        </button>
      </div>

      {loading ? (
        <div className="pl-loading big"><Loader2 size={22} className="spin" /> Loading playlists…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><ListMusic size={30} /></div>
          <h3>No playlists yet</h3>
          <p>Create one above, then add tracks with the Playlist button on any song.</p>
        </div>
      ) : (
        <div className="pl-grid">{items.map((p) => <PlaylistCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}