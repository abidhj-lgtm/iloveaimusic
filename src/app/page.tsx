"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, X, Plus, Sparkles, Headphones, TrendingUp, Wand2, Music2, Play, Heart,
  MessageCircle, Flame, ArrowUp, SlidersHorizontal, Bookmark, LogIn
} from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { TrackCard, SkeletonCard, EmptyState } from "@/components/track-card";
import { Avatar, CopyButton } from "@/components/ui";
import { formatCount, timeAgo } from "@/lib/utils";
import { TrendingSection } from "@/components/trending-section";

type View = "all" | "upload" | "youtube" | "saved" | "liked" | "following";
type Sort = "new" | "old" | "liked" | "played";
const PAGE = 5;

export default function HomePage() {
  return <Suspense fallback={null}><HomeInner /></Suspense>;
}

function HomeInner() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { state, currentUser, likeCount, isFollowing, toggleFollow, userById, demoLogin } = store;

  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("new");
  const [limit, setLimit] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [isApiSearching, setIsApiSearching] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const highlightId = params.get("new");

  useEffect(() => {
    const v = params.get("view");
    if (v === "saved" || v === "liked" || v === "following" || v === "youtube" || v === "upload") setView(v);
    if (params.get("focus") === "search") setTimeout(() => searchRef.current?.focus(), 120);
    if (highlightId) { window.scrollTo({ top: 0 }); setView("all"); setQ(""); setSort("new"); }
    try {
      const saved = localStorage.getItem("ilistenai:view");
      if (saved && !v) { const p = JSON.parse(saved); if (p.view) setView(p.view); if (p.sort) setSort(p.sort); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem("ilistenai:view", JSON.stringify({ view, sort })); } catch { /* ignore */ }
  }, [view, sort]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 900);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/tags", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) setAvailableTags(data.tags ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim() || genre || mood) {
      setIsApiSearching(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (genre) params.set("genre", genre);
      if (mood) params.set("mood", mood);
      params.set("limit", "50");
      
      fetch(`/api/tracks?${params.toString()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok) setApiResults(data.items ?? []);
        })
        .catch(() => setApiResults([]))
        .finally(() => setIsApiSearching(false));
    } else {
      setApiResults([]);
      setIsApiSearching(false);
    }
  }, [q, genre, mood]);

  const filtered = useMemo(() => {
    // If we are actively searching via API, use those results
    if (q.trim() || genre || mood) {
      return apiResults.map((item: any) => item.track);
    }

    let list = [...state.tracks];
    if (view === "upload") list = list.filter((t) => t.source === "upload");
    if (view === "youtube") list = list.filter((t) => t.source === "youtube");
    if (view === "saved" && currentUser) list = list.filter((t) => state.saves.some((s) => s.userId === currentUser.id && s.trackId === t.id));
    if (view === "liked" && currentUser) list = list.filter((t) => state.likes.some((s) => s.userId === currentUser.id && s.trackId === t.id));
    if (view === "following" && currentUser) {
      const ids = state.follows.filter((f) => f.followerId === currentUser.id).map((f) => f.targetId);
      list = list.filter((t) => ids.includes(t.userId));
    }
    if (sort === "new") list.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "old") list.sort((a, b) => a.createdAt - b.createdAt);
    if (sort === "liked") list.sort((a, b) => likeCount(b) - likeCount(a));
    if (sort === "played") list.sort((a, b) => b.plays - a.plays);
    return list;
  }, [apiResults, state.tracks, state.saves, state.likes, state.follows, view, q, genre, mood, sort, currentUser, likeCount]);

  const visible = filtered.slice(0, limit);
  const queueIds = filtered.map((t) => t.id);
  const hasMore = limit < filtered.length;

  useEffect(() => { setLimit(PAGE); }, [q, view, sort]);

  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const ob = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => { setLimit((l) => l + PAGE); setLoadingMore(false); }, 420);
      }
    }, { rootMargin: "300px" });
    ob.observe(sentinel.current);
    return () => ob.disconnect();
  }, [hasMore, loadingMore, filtered.length]);

  const gatedView = (view === "saved" || view === "liked" || view === "following") && !currentUser;

  const artists = state.users
    .map((u) => ({ u, latest: Math.max(0, ...state.tracks.filter((t) => t.userId === u.id).map((t) => t.createdAt)) }))
    .filter((x) => x.latest > 0)
    .sort((a, b) => b.latest - a.latest);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    state.tracks.forEach((t) => t.stylePrompt.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s && s.length < 24).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [state.tracks]);

  const prompts = state.tracks.filter((t) => t.stylePrompt).map((t) => t.stylePrompt);
  const promptOfDay = prompts.length ? prompts[Math.floor(Date.now() / 86400000) % prompts.length] : "";
  const totalPlays = state.tracks.reduce((a, t) => a + t.plays, 0);
  const suggested = state.users.filter((u) => u.id !== currentUser?.id && !isFollowing(u.id)).slice(0, 3);

  const chips: { id: View; label: string }[] = [
    { id: "all", label: "All music" },
    { id: "upload", label: "Uploads & synths" },
    { id: "youtube", label: "YouTube" },
    ...(currentUser ? [{ id: "following" as View, label: "Following" }, { id: "liked" as View, label: "Liked" }, { id: "saved" as View, label: "Saved" }] : [])
  ];

  return (
    <div className="home">
      <div className="feed-col">
        <TrendingSection />
        <div className="stories" aria-label="Artists">
          {currentUser && (
            <Link href="/create" className="story">
              <span className="story-add"><Avatar user={currentUser} size={56} /><span className="story-plus"><Plus size={13} /></span></span>
              <em>Your studio</em>
            </Link>
          )}
          {artists.map(({ u, latest }) => (
            <Link key={u.id} href={`/profile/${u.handle}`} className="story">
              <span className={`story-ring${Date.now() - latest < 86400000 ? " fresh" : ""}`}><Avatar user={u} size={56} /></span>
              <em>{u.name.split(" ")[0]}</em>
            </Link>
          ))}
        </div>

        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles, artists, prompts…" aria-label="Search music"
            />
            {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Clear search"><X size={15} /></button>}
          </div>
          <div className="search-filters-row">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="select filter-select" aria-label="Filter by genre">
              <option value="">All genres</option>
              {availableTags.filter(t => !["chill", "energetic", "melancholic", "upbeat"].includes(t)).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={mood} onChange={(e) => setMood(e.target.value)} className="select filter-select" aria-label="Filter by mood">
              <option value="">All moods</option>
              {availableTags.filter(t => ["chill", "energetic", "melancholic", "upbeat"].includes(t)).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-row">
            <div className="chips" role="tablist" aria-label="Filter feed">
              {chips.map((c) => (
                <button key={c.id} role="tab" aria-selected={view === c.id} className={`chip${view === c.id ? " active" : ""}`} onClick={() => setView(c.id)}>{c.label}</button>
              ))}
            </div>
            <label className="sort-wrap">
              <SlidersHorizontal size={14} />
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort feed">
                <option value="new">Newest first</option>
                <option value="old">Oldest first</option>
                <option value="liked">Most liked</option>
                <option value="played">Most played</option>
              </select>
            </label>
          </div>
          {(q || view !== "all" || genre || mood) && (
            <div className="result-line">
              <span>
                {isApiSearching ? "Searching…" : `${filtered.length} track${filtered.length === 1 ? "" : "s"} found`}
                {q ? ` for “${q}”` : ""}
              </span>
              <button className="more-btn" onClick={() => { setQ(""); setView("all"); setGenre(""); setMood(""); }}>Clear</button>
            </div>
          )}
        </div>

        {gatedView ? (
          <EmptyState
            icon={<LogIn size={30} />} title="This shelf needs a key"
            body={`Log in to see your ${view} music. Your collection is waiting.`}
            action={<Link href={`/login?next=${encodeURIComponent(`/?view=${view}`)}`} className="btn btn-brand">Log in</Link>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Headphones size={30} />} title={q ? "Nothing on this frequency" : "Silence… for now"}
            body={q ? "No tracks match that search. Try a different word, or clear the filters." : view === "following" ? "Follow a few artists and their music will land here." : view === "saved" ? "Tap the bookmark on any track to keep it here." : view === "liked" ? "Heart a track and it will show up here." : "Be the first to post music to the feed."}
            action={q ? <button className="btn btn-ghost" onClick={() => setQ("")}>Clear search</button> : <Link href="/create" className="btn btn-brand"><Sparkles size={16} />Post music</Link>}
          />
        ) : (
          <div className="feed">
            {visible.map((t, i) => (
              <React.Fragment key={t.id}>
                <TrackCard track={t} queue={queueIds} index={i} highlight={t.id === highlightId} />
                {!currentUser && i === 1 && (
                  <div className="join-card fade-up">
                    <div className="join-glow" />
                    <Music2 size={26} />
                    <div>
                      <h3>Your music belongs here.</h3>
                      <p>Sign up with your Gmail, verify, and post your first AI track in under a minute.</p>
                    </div>
                    <div className="join-actions">
                      <Link href="/signup" className="btn btn-brand btn-sm">Join the studio</Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => { demoLogin(); toast.push({ kind: "ok", msg: "Welcome to the demo studio, Aria." }); }}>Try the demo</button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
            {loadingMore && <SkeletonCard />}
            {hasMore && <div ref={sentinel} className="sentinel" />}
            {!hasMore && filtered.length > PAGE && <div className="feed-end"><EqDot />You've reached the end of the feed. Go make something.</div>}
          </div>
        )}
      </div>

      <aside className="rail" aria-label="Discover">
        {currentUser ? (
          <div className="rail-card studio-card">
            <Link href={`/profile/${currentUser.handle}`} className="studio-head">
              <Avatar user={currentUser} size={46} />
              <span><strong>{currentUser.name}</strong><em>@{currentUser.handle}</em></span>
            </Link>
            <div className="studio-stats">
              <span><strong>{state.tracks.filter((t) => t.userId === currentUser.id).length}</strong><em>tracks</em></span>
              <span><strong>{formatCount(state.tracks.filter((t) => t.userId === currentUser.id).reduce((a, t) => a + likeCount(t), 0))}</strong><em>likes</em></span>
              <span><strong>{formatCount(state.tracks.filter((t) => t.userId === currentUser.id).reduce((a, t) => a + t.plays, 0))}</strong><em>plays</em></span>
            </div>
            <Link href="/create" className="btn btn-brand btn-sm wfull"><Plus size={15} />Post music</Link>
          </div>
        ) : (
          <div className="rail-card studio-card">
            <h3 className="rail-title"><Sparkles size={16} />Join I Love AI Music</h3>
            <p className="rail-copy">A home for AI-made music: the track, the story, the prompt, the lyrics.</p>
            <Link href="/signup" className="btn btn-brand btn-sm wfull">Create your account</Link>
            <button className="btn btn-ghost btn-sm wfull" onClick={() => { demoLogin(); toast.push({ kind: "ok", msg: "Welcome to the demo studio, Aria." }); }}>Enter the demo studio</button>
          </div>
        )}

        <div className="rail-card">
          <h3 className="rail-title"><TrendingUp size={16} />Studio pulse</h3>
          <div className="pulse-grid">
            <span><Music2 size={15} /><strong>{formatCount(state.tracks.length)}</strong><em>tracks</em></span>
            <span><Play size={14} /><strong>{formatCount(totalPlays)}</strong><em>plays</em></span>
            <span><Wand2 size={15} /><strong>{state.tracks.filter((t) => t.preset).length}</strong><em>synthesized</em></span>
            <span><MessageCircle size={15} /><strong>{formatCount(state.comments.length)}</strong><em>comments</em></span>
          </div>
        </div>

        {suggested.length > 0 && (
          <div className="rail-card">
            <h3 className="rail-title"><Flame size={16} />Artists to follow</h3>
            {suggested.map((u) => (
              <div className="suggest-row" key={u.id}>
                <Link href={`/profile/${u.handle}`} className="suggest-info">
                  <Avatar user={u} size={36} />
                  <span><strong>{u.name}</strong><em>{state.tracks.filter((t) => t.userId === u.id).length} tracks</em></span>
                </Link>
                <button className={`btn btn-sm ${isFollowing(u.id) ? "btn-ghost" : "btn-outline"}`} onClick={() => {
                  if (!currentUser) { toast.push({ kind: "info", msg: "Log in to follow artists.", action: { label: "Log in", fn: () => router.push("/login?next=%2F") } }); return; }
                  toggleFollow(u.id);
                  toast.push({ kind: "ok", msg: `Following ${u.name}.` });
                }}>{isFollowing(u.id) ? "Following" : "Follow"}</button>
              </div>
            ))}
          </div>
        )}

        {promptOfDay && (
          <div className="rail-card prompt-day">
            <h3 className="rail-title"><Wand2 size={16} />Prompt of the day</h3>
            <p className="prompt-day-text">{promptOfDay}</p>
            <CopyButton text={promptOfDay} label="Copy prompt" />
          </div>
        )}

        {tags.length > 0 && (
          <div className="rail-card">
            <h3 className="rail-title"><HashIcon />Trending tags</h3>
            <div className="tag-cloud">
              {tags.map(([tag, n]) => (
                <button key={tag} className="chip" onClick={() => { setQ(tag); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{tag}<em>{n}</em></button>
              ))}
            </div>
          </div>
        )}
        <div className="rail-foot">I Love AI Music · made for machines that dream in audio</div>
      </aside>

      {showTop && (
        <button className="new-pill" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp size={15} />Back to the newest
        </button>
      )}
    </div>
  );
}

function EqDot() { return <span className="eq eq-sm on" aria-hidden><i /><i /><i /><i /><i /></span>; }
function HashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" /></svg>;
}