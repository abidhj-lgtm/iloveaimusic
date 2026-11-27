"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListMusic, Loader2, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { coverUrl } from "@/lib/covers";
import { formatDuration, formatCount } from "@/lib/utils";

interface PlaylistFull {
  id: string; user_id: string; title: string; description: string;
  cover_seed: string; cover_palette: number; track_count: number; is_public: boolean;
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const { state, userById, currentUser } = useStore();
  const [playlist, setPlaylist] = useState<PlaylistFull | null>(null);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "private">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/playlists/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!d?.ok) { setStatus(d?.code === "forbidden" ? "private" : "missing"); return; }
      setPlaylist(d.playlist); setTrackIds(d.trackIds ?? []); setIsOwner(!!d.isOwner); setStatus("ok");
    } catch { setStatus("missing"); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (status === "loading") return <div className="pl-loading big"><Loader2 size={22} className="spin" /> Loading playlist…</div>;
  if (status === "missing") return <div className="empty"><div className="empty-icon"><ListMusic size={30} /></div><h3>Playlist not found</h3><p>It may have been deleted.</p></div>;
  if (status === "private" || !playlist) return <div className="empty"><div className="empty-icon"><ListMusic size={30} /></div><h3>Private playlist</h3><p>Only its owner can see this.</p></div>;

  const owner = userById(playlist.user_id);
  const tracks = trackIds
    .map((tid) => state.tracks.find((t) => t.id === tid))
    .filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <div className="pl-detail">
      <div className="pl-hero">
        <img className="pl-hero-cover" src={coverUrl(playlist.cover_seed || playlist.id, playlist.cover_palette)} alt="" />
        <div className="pl-hero-info">
          <span className="pl-hero-kicker"><ListMusic size={15} /> Playlist · {playlist.is_public ? "Public" : "Private"}</span>
          <h1 className="pl-hero-title">{playlist.title}</h1>
          {playlist.description && <p className="pl-hero-desc">{playlist.description}</p>}
          <p className="pl-hero-meta">
            {tracks.length} track{tracks.length === 1 ? "" : "s"}
            {owner && <> · by <Link href={`/profile/${owner.handle}`} className="pl-owner">{owner.name}</Link></>}
            {isOwner && <> · <Link href="/playlists" className="pl-owner">Manage</Link></>}
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty"><div className="empty-icon"><ListMusic size={28} /></div><h3>Nothing here yet</h3><p>Add tracks with the Playlist button on any song.</p></div>
      ) : (
        <ol className="pl-tracks">
          {tracks.map((t, i) => {
            const artist = userById(t.userId);
            return (
              <li key={t.id} className="pl-track-row">
                <span className="pl-track-num">{i + 1}</span>
                <img className="pl-track-cover" src={coverUrl(t.coverSeed, t.coverPalette)} alt="" />
                <span className="pl-track-main">
                  <Link href={`/track/${t.id}`} className="pl-track-title">{t.title}</Link>
                  <em>{artist ? artist.name : "Unknown artist"} · {formatCount(t.plays)} plays</em>
                </span>
                {t.duration ? <span className="pl-track-dur">{formatDuration(t.duration)}</span> : null}
                <Link href={`/track/${t.id}`} className="pl-track-play" aria-label={`Open ${t.title}`}><Play size={15} fill="currentColor" /></Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}