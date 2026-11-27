"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListMusic, Loader2, Play, GripVertical, Share2, Check, UserPlus, UserMinus } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { coverUrl } from "@/lib/covers";
import { formatDuration, formatCount, copyText } from "@/lib/utils";
import { pageMetadata, ogImageUrl, profilePageJsonLd, breadcrumbJsonLd, jsonLdScript, musicPlaylistJsonLd, SITE } from "@/lib/seo";

interface PlaylistFull {
  id: string; user_id: string; title: string; description: string;
  cover_seed: string; cover_palette: number; track_count: number; is_public: boolean;
  follower_count?: number;
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const { state, userById, currentUser } = useStore();
  const toast = useToast();
  const [playlist, setPlaylist] = useState<PlaylistFull | null>(null);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "private">("loading");
  const [isReordering, setIsReordering] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/playlists/${encodeURIComponent(id as string)}`, { credentials: "same-origin", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!d?.ok) { setStatus(d?.code === "forbidden" ? "private" : "missing"); return; }
      setPlaylist(d.playlist); setTrackIds(d.trackIds ?? []); setIsOwner(!!d.isOwner); setStatus("ok");
      
      // Load follow status
      if (currentUser && !d.isOwner) {
        const followRes = await fetch(`/api/playlists/${id}/follow`, { credentials: "same-origin", cache: "no-store" });
        const followData = await followRes.json().catch(() => ({}));
        if (followData?.ok) {
          setIsFollowing(followData.isFollowing);
          setFollowerCount(followData.followerCount);
        }
      }
    } catch { setStatus("missing"); }
  }, [id, currentUser]);

  useEffect(() => { void load(); }, [load]);

  const onDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedId(trackId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...trackIds];
    const dragIdx = newOrder.indexOf(draggedId);
    const targetIdx = newOrder.indexOf(targetId);
    
    newOrder.splice(dragIdx, 1);
    newOrder.splice(targetIdx, 0, draggedId);
    
    setTrackIds(newOrder);
    setDraggedId(null);
    setIsReordering(true);

    try {
      const res = await fetch(`/api/playlists/${id}/tracks/reorder`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds: newOrder })
      });
      const d = await res.json().catch(() => ({}));
      if (!d?.ok) {
        toast.push({ kind: "err", msg: "Failed to save order." });
        await load();
      }
    } catch {
      toast.push({ kind: "err", msg: "Network error saving order." });
      await load();
    } finally {
      setIsReordering(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser) {
      toast.push({ kind: "info", msg: "Log in to follow playlists." });
      return;
    }
    try {
      const res = await fetch(`/api/playlists/${id}/follow`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isFollowing ? "unfollow" : "follow" })
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok) {
        setIsFollowing(d.isFollowing);
        setFollowerCount(d.followerCount);
        toast.push({ kind: "ok", msg: d.isFollowing ? "Following this playlist." : "Unfollowed." });
      }
    } catch {
      toast.push({ kind: "err", msg: "Could not update follow status." });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/playlist/${id}`;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.push({ kind: "ok", msg: "Link copied — share it anywhere." });
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.push({ kind: "err", msg: "Couldn't copy the link." });
    }
  };

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
            {!isOwner && playlist.is_public && followerCount > 0 && <> · {formatCount(followerCount)} follower{followerCount === 1 ? "" : "s"}</>}
          </p>
          <div className="pl-hero-actions">
            {!isOwner && playlist.is_public && currentUser && (
              <button
                type="button"
                className={`btn ${isFollowing ? "btn-outline" : "btn-brand"} btn-sm`}
                onClick={toggleFollow}
              >
                {isFollowing ? <><UserMinus size={15} /> Unfollow</> : <><UserPlus size={15} /> Follow</>}
              </button>
            )}
            {playlist.is_public && (
              <button
                type="button"
                className={`btn btn-ghost btn-sm${copied ? " done" : ""}`}
                onClick={share}
              >
                {copied ? <><Check size={15} /> Copied</> : <><Share2 size={15} /> Share</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty"><div className="empty-icon"><ListMusic size={28} /></div><h3>Nothing here yet</h3><p>Add tracks with the Playlist button on any song.</p></div>
      ) : (
        <ol className="pl-tracks">
          {tracks.map((t, i) => {
            const artist = userById(t.userId);
            return (
              <li 
                key={t.id} 
                className={`pl-track-row${isOwner ? " draggable" : ""}`}
                draggable={isOwner}
                onDragStart={(e) => onDragStart(e, t.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, t.id)}
              >
                {isOwner && <span className="pl-track-grip"><GripVertical size={16} /></span>}
                <span className="pl-track-num">{i + 1}</span>
                <img className="pl-track-cover" src={coverUrl(t.coverSeed, t.coverPalette)} alt="" />
                <span className="pl-track-main">
                  <Link href={`/track/${t.id}`} className="pl-track-title">{t.title}</Link>
                  <em>{artist ? artist.name : "Unknown artist"} · {formatCount(t.plays)} plays</em>
                </span>
                {t.duration ? <span className="pl-track-dur">{formatDuration(t.duration)}</span> : null}
                <Link href={`/track/${t.id}`} className="pl-track-play" aria-label={`Open ${t.title}`}><Play size={15} fill="currentColor" /></Link>
                {isOwner && isReordering && draggedId === t.id && <span className="pl-track-saving"><Loader2 size={14} className="spin" /></span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}