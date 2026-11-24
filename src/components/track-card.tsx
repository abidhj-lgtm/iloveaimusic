"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Heart, MessageCircle, Share2, Bookmark, Play, Pause, MoreHorizontal, Pencil, Trash2,
  Link2, Youtube, Upload, Wand2, Loader2, Send, X, Music2, Disc3, Headphones, Flag
} from "lucide-react";
import type { Track } from "@/lib/types";
import { useStore, useToast } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { useMediaUrl } from "@/lib/idb";
import { coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { timeAgo, formatCount, formatDuration, copyText, blip } from "@/lib/utils";
import { Avatar, SmartImg, Menu, Eq, ConfirmDialog, EmptyState } from "./ui";
import { ReportDialog } from "./report-dialog";

export function useTrackThumb(t: Track): { src: string; fallback: string } {
  const media = useMediaUrl(t.thumbKey);
  const fallback = coverUrl(t.coverSeed, t.coverPalette);
  const src = t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : (media ?? fallback);
  return { src, fallback };
}

export function SourceBadge({ t, compact = false }: { t: Track; compact?: boolean }) {
  const size = compact ? 11 : 13;
  if (t.source === "youtube") return <span className={`src-badge yt${compact ? " sm" : ""}`}><Youtube size={size} />{t.live ? "Live" : "YouTube"}</span>;
  if (t.preset) return <span className={`src-badge gen${compact ? " sm" : ""}`}><Wand2 size={size} />Synth</span>;
  return <span className={`src-badge up${compact ? " sm" : ""}`}><Upload size={size} />Upload</span>;
}

export function PromptChip({ prompt }: { prompt: string }) {
  const toast = useToast();
  if (!prompt.trim()) return null;
  return (
    <button className="prompt-chip" title="Copy the style prompt"
      onClick={async () => { const ok = await copyText(prompt); toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Prompt copied — go make something." : "Couldn't copy the prompt." }); }}>
      <Wand2 size={13} /><span>{prompt}</span>
    </button>
  );
}

export function LyricsView({ track }: { track: Track }) {
  if (track.instrumental || !track.lyrics.trim()) {
    return (
      <div className="instru">
        <Disc3 size={34} className="slow-spin" />
        <div><strong>Instrumental</strong><p>No lyrics — let the frequencies do the talking.</p></div>
      </div>
    );
  }
  return (
    <div className="lyrics">
      {track.lyrics.replace(/\r/g, "").split(/\n{2,}/).map((block, bi) => (
        <div className="stanza" key={bi}>
          {block.split("\n").map((line, li) => {
            const m = line.trim().match(/^\[(.+)\]$/);
            if (m) return <span className="sec-marker" key={li}>{m[1]}</span>;
            return <span className="lyric-line" key={li}>{line || "\u00A0"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export function CommentsPanel({ track, autoFocus = false }: { track: Track; autoFocus?: boolean }) {
  const { currentUser, commentsFor, userById, addComment, deleteComment } = useStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<{ id: string; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const comments = commentsFor(track.id);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [comments.length]);

  const submit = () => {
    if (!text.trim() || !currentUser) return;
    addComment(track.id, text); setText("");
  };

  const startReport = (id: string, name: string) => {
    if (!currentUser) {
      toast.push({ kind: "info", msg: "Log in to report content.", action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    setReporting({ id, label: `Comment by ${name}` });
  };

  return (
    <div className="comments-panel">
      <div className="comments-list" ref={listRef}>
        {comments.length === 0 ? (
          <div className="comments-empty"><MessageCircle size={26} /><p>No comments yet. Say something kind — or something clever.</p></div>
        ) : comments.map((c) => {
          const u = userById(c.userId);
          if (!u) return null;
          const mine = currentUser?.id === c.userId;
          return (
            <div className="comment" key={c.id}>
              <Link href={`/profile/${u.handle}`}><Avatar user={u} size={32} /></Link>
              <div className="comment-body">
                <div className="comment-meta">
                  <Link href={`/profile/${u.handle}`} className="comment-name">{u.name}</Link>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                </div>
                <p>{c.text}</p>
              </div>
              <div className="comment-tools">
                {!mine && (
                  <button className="icon-btn comment-report" aria-label={`Report comment by ${u.name}`} title="Report comment" onClick={() => startReport(c.id, u.name)}>
                    <Flag size={13} />
                  </button>
                )}
                {mine && (
                  <button className="icon-btn comment-del" aria-label="Delete comment" onClick={() => {
                    const undo = deleteComment(c.id);
                    toast.push({ kind: "info", msg: "Comment removed.", action: undo ? { label: "Undo", fn: undo } : undefined });
                  }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {currentUser ? (
        <div className="composer">
          <Avatar user={currentUser} size={32} />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Add a comment…" maxLength={400} aria-label="Add a comment" />
          <button className="icon-btn send-btn" onClick={submit} disabled={!text.trim()} aria-label="Send comment"><Send size={17} /></button>
        </div>
      ) : (
        <div className="composer-gate">
          <p>Log in to join the conversation.</p>
          <button className="btn btn-brand btn-sm" onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>Log in</button>
        </div>
      )}
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} commentId={reporting?.id} targetLabel={reporting?.label ?? "Comment"} />
    </div>
  );
}

export function CommentsDrawer({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const player = usePlayer();
  const { userById } = useStore();
  const { src, fallback } = useTrackThumb(track ?? ({ coverSeed: "x", coverPalette: 0, source: "upload" } as Track));
  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [track, onClose]);
  if (!track) return null;
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Comments on ${track.title}`}>
        <div className="drawer-head">
          <h3>Comments</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close comments"><X size={19} /></button>
        </div>
        <div className="drawer-track">
          <SmartImg src={src} fallback={fallback} alt="" className="drawer-cover" />
          <div className="drawer-track-info">
            <Link href={`/track/${track.id}`} onClick={onClose}><strong>{track.title}</strong></Link>
            <span>{artist?.name} · {timeAgo(track.createdAt)}</span>
          </div>
          <button className="p-play sm" onClick={() => isThis ? player.toggle() : player.playTrack(track)} aria-label="Play">
            {isThis && player.buffering ? <Loader2 size={16} className="spin" /> : isThis && player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>
        <CommentsPanel track={track} autoFocus />
      </aside>
    </div>
  );
}

export function TrackCard({ track, queue, index = 0, highlight = false }: { track: Track; queue: string[]; index?: number; highlight?: boolean }) {
  const store = useStore();
  const toast = useToast();
  const player = usePlayer();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, userById, likeCount, isLiked, isSaved, toggleLike, toggleSave, deleteTrack, commentsFor } = store;
  const artist = userById(track.userId);
  const { src, fallback } = useTrackThumb(track);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reporting, setReporting] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liked = isLiked(track.id);
  const saved = isSaved(track.id);
  const isThis = player.track?.id === track.id;
  const isPlaying = isThis && player.playing;
  const comments = commentsFor(track.id);
  const owner = currentUser?.id === track.userId;

  const gate = (what: string): boolean => {
    if (currentUser) return true;
    toast.push({ kind: "info", msg: `Log in to ${what}.`, action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
    return false;
  };

  const doLike = (fromDouble = false) => {
    if (!gate("like music")) return;
    if (!liked || fromDouble) {
      if (!liked) toggleLike(track.id);
      setBurst(true); blip(store.state.prefs.muted, 920);
      setTimeout(() => setBurst(false), 700);
    } else if (!fromDouble) toggleLike(track.id);
  };

  const onMediaClick = () => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      isThis ? player.toggle() : player.playTrack(track, queue);
    }, 230);
  };
  const onMediaDouble = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    doLike(true);
  };

  const share = async () => {
    const ok = await copyText(`${window.location.origin}/track/${track.id}`);
    toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Link copied — spread the sound." : "Couldn't copy the link." });
  };

  const onDelete = () => {
    const undo = deleteTrack(track.id);
    toast.push({ kind: "info", msg: `“${track.title}” deleted.`, action: undo ? { label: "Undo", fn: undo } : undefined });
  };

  if (!artist) return null;
  const bgLong = track.background.length > 150;

  return (
    <>
      <article className={`tcard fade-up${highlight ? " glow-new" : ""}${isPlaying ? " is-playing" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
        <div className="tcard-head">
          <Link href={`/profile/${artist.handle}`} className="tcard-artist">
            <Avatar user={artist} size={38} ring />
            <span className="tcard-artist-info">
              <strong>{artist.name}</strong>
              <em>@{artist.handle} · {timeAgo(track.createdAt)}</em>
            </span>
          </Link>
          <div className="tcard-head-right">
            <SourceBadge t={track} />
            <Menu
              trigger={<MoreHorizontal size={19} />}
              items={owner ? [
                { label: "Edit track", icon: <Pencil size={15} />, onClick: () => router.push(`/create?edit=${track.id}`) },
                { label: "Copy link", icon: <Link2 size={15} />, onClick: share },
                { label: "Delete track", icon: <Trash2 size={15} />, danger: true, onClick: () => setConfirmDel(true) }
              ] : [
                { label: "Copy link", icon: <Link2 size={15} />, onClick: share },
                { label: saved ? "Remove from saved" : "Save track", icon: <Bookmark size={15} />, onClick: () => { if (gate("save music")) { toggleSave(track.id); toast.push({ kind: "ok", msg: saved ? "Removed from saved." : "Saved to your collection." }); } } },
                { label: "More from this artist", icon: <Headphones size={15} />, onClick: () => router.push(`/profile/${artist.handle}`) },
                { label: "Report track", icon: <Flag size={15} />, danger: true, onClick: () => { if (gate("report content")) setReporting(true); } }
              ]}
            />
          </div>
        </div>

        <div className="tcard-media" onClick={onMediaClick} onDoubleClick={onMediaDouble} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isThis ? player.toggle() : player.playTrack(track, queue); } }}
          aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}>
          <SmartImg src={src} fallback={fallback} alt={`Cover art for ${track.title}`} className="media-img" />
          <div className="media-shade" />
          <span className={`play-overlay${isPlaying ? " playing" : ""}`}>
            {isThis && player.buffering ? <Loader2 size={26} className="spin" /> : isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="nudge" />}
          </span>
          {isPlaying && <span className="media-eq"><Eq playing /></span>}
          {track.live && <span className="live-badge corner"><i />LIVE</span>}
          {track.duration && !track.live && <span className="dur-badge">{formatDuration(track.duration)}</span>}
          <Link href={`/track/${track.id}`} className="open-link" onClick={(e) => e.stopPropagation()} aria-label="Open track page"><ArrowIcon /></Link>
          {burst && <span className="burst"><Heart size={84} fill="currentColor" /></span>}
        </div>

        <div className="tcard-actions">
          <button className={`act${liked ? " liked" : ""}`} onClick={() => doLike(false)} aria-label={liked ? "Unlike" : "Like"}>
            <Heart size={23} fill={liked ? "currentColor" : "none"} /><span className="act-count">{formatCount(likeCount(track))}</span>
          </button>
          <button className="act" onClick={() => setDrawer(true)} aria-label="Comments">
            <MessageCircle size={23} /><span className="act-count">{formatCount(comments.length)}</span>
          </button>
          <button className="act" onClick={share} aria-label="Share"><Share2 size={22} /></button>
          <span className="act-plays"><Play size={13} fill="currentColor" />{formatCount(track.plays)}</span>
          <button className={`act save${saved ? " saved" : ""}`} onClick={() => { if (gate("save music")) { toggleSave(track.id); toast.push({ kind: "ok", msg: saved ? "Removed from saved." : "Saved to your collection." }); } }} aria-label={saved ? "Unsave" : "Save"}>
            <Bookmark size={22} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="tcard-body">
          <Link href={`/track/${track.id}`} className="tcard-title">{track.title}</Link>
          {track.background && (
            <p className={`tcard-bg${expanded ? "" : " clamp"}`}>
              {track.background}
              {bgLong && !expanded && <button className="more-btn" onClick={() => setExpanded(true)}>more</button>}
            </p>
          )}
          <PromptChip prompt={track.stylePrompt} />
          <div className="tcard-links">
            {!track.instrumental && track.lyrics.trim() && <Link href={`/track/${track.id}#lyrics`} className="lyrics-link"><Music2 size={13} />View lyrics</Link>}
            {comments.length > 0 && <button className="comments-peek" onClick={() => setDrawer(true)}>View all {comments.length} comment{comments.length === 1 ? "" : "s"}</button>}
          </div>
        </div>
      </article>

      {drawer && <CommentsDrawer track={track} onClose={() => setDrawer(false)} />}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} trackId={track.id} targetLabel={track.title} />
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={onDelete}
        title="Delete this track?"
        body={<p>“<strong>{track.title}</strong>” will be removed from the feed along with its comments and likes. You can undo for a few seconds.</p>} />
    </>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function CompactCard({ track, queue }: { track: Track; queue: string[] }) {
  const player = usePlayer();
  const { likeCount, userById } = useStore();
  const { src, fallback } = useTrackThumb(track);
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  return (
    <div className={`gcard${isThis && player.playing ? " is-playing" : ""}`}>
      <Link href={`/track/${track.id}`} className="gcard-link" aria-label={track.title}>
        <SmartImg src={src} fallback={fallback} alt="" className="gcard-img" />
        <span className="gcard-badge"><SourceBadge t={track} compact /></span>
      </Link>
      <div className="gcard-overlay">
        <button className="p-play sm" onClick={() => isThis ? player.toggle() : player.playTrack(track, queue)} aria-label={`Play ${track.title}`}>
          {isThis && player.buffering ? <Loader2 size={16} className="spin" /> : isThis && player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <span className="gcard-stats"><Heart size={13} fill="currentColor" />{formatCount(likeCount(track))}<Play size={12} fill="currentColor" />{formatCount(track.plays)}</span>
      </div>
      <div className="gcard-meta">
        <Link href={`/track/${track.id}`} className="gcard-title">{track.title}</Link>
        {artist && <Link href={`/profile/${artist.handle}`} className="gcard-artist">{artist.name}</Link>}
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="tcard skel-card" aria-hidden>
      <div className="skel-row"><span className="skel skel-avatar" /><span className="skel skel-line w40" /></div>
      <div className="skel skel-media" />
      <div className="skel-row"><span className="skel skel-line w60" /></div>
      <div className="skel-row"><span className="skel skel-line w80" /></div>
    </div>
  );
}

export { EmptyState };