"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play, Pause, Heart, Bookmark, Share2, Pencil, Trash2, Loader2, Youtube,
  Headphones, ArrowLeft, Wand2, BookOpen, Music2, MessageCircle
} from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { useTrackThumb, SourceBadge, LyricsView, CommentsPanel, CompactCard } from "@/components/track-card";
import { Avatar, SmartImg, CopyButton, ConfirmDialog, EmptyState } from "@/components/ui";
import { ytEmbed } from "@/lib/youtube";
import { AddToPlaylistButton } from "@/components/playlist-ui";
import { copyText, blip, formatCount, timeAgo } from "@/lib/utils";

function useGate() {
  const { currentUser } = useStore();
  const toast = useToast();
  const router = useRouter();
  return (what: string, next: string): boolean => {
    if (currentUser) return true;
    toast.push({ kind: "info", msg: `Log in to ${what}.`, action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(next)}`) } });
    return false;
  };
}

export function TrackActions({ trackId }: { trackId: string }) {
  const store = useStore();
  const toast = useToast();
  const player = usePlayer();
  const router = useRouter();
  const gate = useGate();
  const { state, currentUser, userById, likeCount, isLiked, isSaved, isFollowing, toggleLike, toggleSave, toggleFollow, deleteTrack, commentsFor } = store;
  const track = state.tracks.find((t) => t.id === trackId);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!track) return null;

  const artist = userById(track.userId);
  const liked = isLiked(track.id);
  const saved = isSaved(track.id);
  const owner = currentUser?.id === track.userId;
  const isThis = player.track?.id === track.id;
  const playing = isThis && player.playing;
  const related = state.tracks.filter((t) => t.userId === track.userId && t.id !== track.id).map((t) => t.id);
  const queue = [track.id, ...related];
  const path = `/track/${track.id}`;

  const share = async () => {
    const ok = await copyText(`${window.location.origin}${path}`);
    toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Link copied — spread the sound." : "Couldn't copy the link." });
  };

  return (
    <>
      <div className="stat-row seo-stats">
        <span className="stat-plays" title={`${track.plays.toLocaleString()} plays`}>
          <span className="stat-eq" aria-hidden><i /><i /><i /><i /></span>
          <strong>{formatCount(track.plays)}</strong> plays
        </span>
        <span className={`stat-loves${liked ? " on" : ""}`} title={`${likeCount(track).toLocaleString()} loves`}>
          <Heart size={14} fill="currentColor" />
          <strong>{formatCount(likeCount(track))}</strong> loves
        </span>
        <span className="stat-talk" title={`${commentsFor(track.id).length} comments`}>
          <MessageCircle size={14} />
          <strong>{formatCount(commentsFor(track.id).length)}</strong> comments
        </span>
      </div>
      <div className="big-actions seo-actions">
        <button className="btn btn-brand" onClick={() => (isThis ? player.toggle() : player.playTrack(track, queue))}>
          {isThis && player.buffering ? <Loader2 size={17} className="spin" /> : playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          <span>{playing ? "Pause" : "Play track"}</span>
        </button>
        <button
          className={`btn btn-ghost icon-label love-btn${liked ? " liked" : ""}`}
          aria-pressed={liked}
          onClick={() => { if (gate("like music", path)) { toggleLike(track.id); if (!liked) blip(state.prefs.muted, 920); } }}
        >
          <span className="love-ico">
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </span>
          <span>{liked ? "Liked" : "Like"}</span>
        </button>
        <button
          className={`btn btn-ghost icon-label save-btn${saved ? " saved" : ""}`}
          aria-pressed={saved}
          onClick={() => { if (gate("save music", path)) { toggleSave(track.id); toast.push({ kind: "ok", msg: saved ? "Removed from saved." : "Saved to your collection." }); } }}
        >
          <span className="save-ico">
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          </span>
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
        <button className="btn btn-ghost icon-label" onClick={share}><Share2 size={17} /><span>Share</span></button>
        <AddToPlaylistButton trackId={track.id} title={track.title} />
        {artist && !owner && (
          <button className={`btn ${isFollowing(artist.id) ? "btn-ghost" : "btn-outline"} icon-label`} onClick={() => { if (gate("follow artists", path)) { toggleFollow(artist.id); toast.push({ kind: "ok", msg: isFollowing(artist.id) ? `Unfollowed ${artist.name}.` : `Following ${artist.name}.` }); } }}>
            <span>{isFollowing(artist.id) ? "Following" : `Follow ${artist.name.split(" ")[0]}`}</span>
          </button>
        )}
        {owner && (
          <>
            <Link href={`/create?edit=${track.id}`} className="btn btn-ghost icon-label"><Pencil size={16} /><span>Edit</span></Link>
            <button className="btn btn-danger-ghost icon-label" onClick={() => setConfirmDel(true)}><Trash2 size={16} /><span>Delete</span></button>
          </>
        )}
      </div>

      <div className="seo-livecounts">
        <span><Play size={13} fill="currentColor" /><strong>{formatCount(track.plays)}</strong> plays</span>
        <span><Heart size={13} fill="currentColor" /><strong>{formatCount(likeCount(track))}</strong> likes</span>
        <span><MessageCircle size={13} /><strong>{store.commentsFor(track.id).length}</strong> comments</span>
      </div>

      <ConfirmDialog
        open={confirmDel} onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          const undo = deleteTrack(track.id);
          toast.push({ kind: "info", msg: `“${track.title}” deleted.`, action: undo ? { label: "Undo", fn: undo } : undefined });
          router.push("/");
        }}
        title="Delete this track?"
        body={<p>“<strong>{track.title}</strong>” will be removed from the feed along with its comments and likes. You can undo for a few seconds.</p>}
      />
    </>
  );
}

export function TrackCoverIsland({ trackId }: { trackId: string }) {
  const { state } = useStore();
  const player = usePlayer();
  const track = state.tracks.find((t) => t.id === trackId);
  const { src, fallback } = useTrackThumb(track ?? ({ coverSeed: trackId, coverPalette: 0, source: "upload" } as any));
  if (!track) return null;
  const isThis = player.track?.id === track.id;
  const playing = isThis && player.playing;
  const related = state.tracks.filter((t) => t.userId === track.userId && t.id !== track.id).map((t) => t.id);
  return (
        <div className={`hero-cover${playing ? " spinning-glow" : ""}`}>
          <SmartImg src={src} fallback={fallback} alt={`Cover art for ${track.title}`} className="hero-cover-img" priority sizes="50vw" width={640} height={640} />
          <button className="hero-play" onClick={() => (isThis ? player.toggle() : player.playTrack(track, [track.id, ...related]))} aria-label={playing ? "Pause" : "Play"}>
        {isThis && player.buffering ? <Loader2 size={30} className="spin" /> : playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="nudge" />}
      </button>
      {track.live && <span className="live-badge corner"><i />LIVE</span>}
    </div>
  );
}

export function TrackEmbed({ trackId, youtubeId }: { trackId: string; youtubeId: string }) {
  const player = usePlayer();
  const ref = useRef<HTMLIFrameElement>(null);
  const active = player.track?.id === trackId && player.playing;
  useEffect(() => {
    if (active && ref.current?.contentWindow) {
      try { ref.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*"); } catch { /* ignore */ }
    }
  }, [active]);
  return (
    <section className="section seo-section" id="watch">
      <h2 className="section-title"><Youtube size={18} />Watch on YouTube</h2>
      <div className="yt-embed-wrap big">
        <iframe ref={ref} src={ytEmbed(youtubeId)} title="YouTube player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    </section>
  );
}

export function TrackComments({ trackId }: { trackId: string }) {
  const { state, commentsFor } = useStore();
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  return (
    <section className="section seo-section" id="comments">
      <h2 className="section-title"><MessageCircle size={18} />Comments · {commentsFor(trackId).length}</h2>
      <div className="comments-full"><CommentsPanel track={track} /></div>
    </section>
  );
}

export function TrackRelated({ trackId }: { trackId: string }) {
  const { state, userById } = useStore();
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  const artist = userById(track.userId);
  const more = state.tracks.filter((t) => t.userId === track.userId && t.id !== track.id).slice(0, 6);
  if (!more.length || !artist) return null;
  return (
    <section className="section seo-section" id="more">
      <h2 className="section-title"><Headphones size={18} />More from {artist.name}</h2>
      <div className="grid3">{more.map((t) => <CompactCard key={t.id} track={t} queue={[track.id, ...more.map((x) => x.id)]} />)}</div>
    </section>
  );
}

export function TrackPromptCopy({ prompt }: { prompt: string }) {
  return <CopyButton text={prompt} label="Copy prompt" />;
}

/** Renders tracks that exist only in this browser (created after the demo seed). */
export function TrackClientOnly({ trackId }: { trackId: string }) {
  const store = useStore();
  const player = usePlayer();
  const toast = useToast();
  const router = useRouter();
  const gate = useGate();
  const { state, currentUser, userById, likeCount, isLiked, isSaved, toggleLike, toggleSave, commentsFor } = store;
  const track = state.tracks.find((t) => t.id === trackId);
  const { src, fallback } = useTrackThumb(track ?? ({ coverSeed: trackId, coverPalette: 0, source: "upload" } as any));
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
    }
  }, [trackId]);

  if (!track) {
    return (
      <div className="detail-page">
        <EmptyState icon={<Headphones size={32} />} title="This track faded out"
          body="It may have been deleted, or it only exists in another browser's local studio. The feed still has plenty of sound."
          action={<Link href="/" className="btn btn-brand"><ArrowLeft size={16} />Back to the feed</Link>} />
      </div>
    );
  }

  const artist = userById(track.userId)!;
  const liked = isLiked(track.id);
  const saved = isSaved(track.id);
  const owner = currentUser?.id === track.userId;
  const isThis = player.track?.id === track.id;
  const playing = isThis && player.playing;
  const more = state.tracks.filter((t) => t.userId === track.userId && t.id !== track.id).slice(0, 6);
  const queue = [track.id, ...more.map((t) => t.id)];
  const path = `/track/${track.id}`;

  return (
    <div className="detail-page">
      <Link href="/" className="back-link"><ArrowLeft size={16} />Back to feed</Link>
      <div className="track-hero fade-up">
        <div className={`hero-cover${playing ? " spinning-glow" : ""}`}>
          <SmartImg src={src} fallback={fallback} alt={`Cover art for ${track.title}`} className="hero-cover-img" priority sizes="50vw" width={640} height={640} />
          <button className="hero-play" onClick={() => (isThis ? player.toggle() : player.playTrack(track, queue))} aria-label={playing ? "Pause" : "Play"}>
            {isThis && player.buffering ? <Loader2 size={30} className="spin" /> : playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="nudge" />}
          </button>
        </div>
        <div className="hero-info">
          <div className="hero-badges"><SourceBadge t={track} /><span className="src-badge neutral">Local studio track</span></div>
          <h1 className="hero-title">{track.title}</h1>
          <div className="artist-row">
            <Link href={`/profile/${artist.handle}`} className="artist-link">
              <Avatar user={artist} size={42} ring />
              <span><strong>{artist.name}</strong><em>@{artist.handle} · {timeAgo(track.createdAt)}</em></span>
            </Link>
          </div>
          <div className="stat-row">
            <span><Play size={14} fill="currentColor" /><strong>{formatCount(track.plays)}</strong> plays</span>
            <span><Heart size={14} fill="currentColor" /><strong>{formatCount(likeCount(track))}</strong> likes</span>
            <span><MessageCircle size={14} /><strong>{commentsFor(track.id).length}</strong> comments</span>
          </div>
          <div className="big-actions">
            <button className="btn btn-brand" onClick={() => (isThis ? player.toggle() : player.playTrack(track, queue))}>
              {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}<span>{playing ? "Pause" : "Play track"}</span>
            </button>
            <button className={`btn btn-ghost icon-label${liked ? " liked" : ""}`} onClick={() => { if (gate("like music", path)) toggleLike(track.id); }}>
              <Heart size={17} fill={liked ? "currentColor" : "none"} /><span>{liked ? "Liked" : "Like"}</span>
            </button>
            <button className={`btn btn-ghost icon-label${saved ? " saved" : ""}`} onClick={() => { if (gate("save music", path)) toggleSave(track.id); }}>
              <Bookmark size={17} fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span>
            </button>
            <button className="btn btn-ghost icon-label" onClick={async () => { const ok = await copyText(`${window.location.origin}${path}`); toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Link copied." : "Couldn't copy." }); }}>
              <Share2 size={17} /><span>Share</span>
            </button>
            {owner && <Link href={`/create?edit=${track.id}`} className="btn btn-ghost icon-label"><Pencil size={16} /><span>Edit</span></Link>}
            {owner && <button className="btn btn-danger-ghost icon-label" onClick={() => setConfirmDel(true)}><Trash2 size={16} /><span>Delete</span></button>}
          </div>
        </div>
      </div>

      {track.stylePrompt && (
        <section className="section" id="prompt">
          <h2 className="section-title"><Wand2 size={18} />Style / Prompt</h2>
          <div className="prompt-block"><p>{track.stylePrompt}</p><CopyButton text={track.stylePrompt} label="Copy prompt" /></div>
        </section>
      )}
      {track.background && (
        <section className="section" id="background">
          <h2 className="section-title"><BookOpen size={18} />Background</h2>
          <p className="prose">{track.background}</p>
        </section>
      )}
      <section className="section" id="lyrics">
        <h2 className="section-title"><Music2 size={18} />Lyrics</h2>
        <LyricsView track={track} />
      </section>
      <TrackComments trackId={track.id} />
      <TrackRelated trackId={track.id} />

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)}
        onConfirm={() => { const undo = store.deleteTrack(track.id); toast.push({ kind: "info", msg: `“${track.title}” deleted.`, action: undo ? { label: "Undo", fn: undo } : undefined }); router.push("/"); }}
        title="Delete this track?" body={<p>“<strong>{track.title}</strong>” will be removed from the feed. You can undo for a few seconds.</p>} />
    </div>
  );
}