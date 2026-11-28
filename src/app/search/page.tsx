"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X, Clock, TrendingUp, Play, Pause, Loader2, Heart } from "lucide-react";
import { SkeletonCard, SourceBadge, useTrackThumb } from "@/components/track-card";
import { usePlayer } from "@/lib/player";
import { useStore } from "@/lib/store";
import { SmartImg } from "@/components/ui";
import { formatCount, formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";

interface SearchResult {
  track: Track;
  comments: any[];
  likedByMe: boolean;
  savedByMe: boolean;
}

const HISTORY_KEY = "ilistenai:search-history";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(query: string) {
  if (!query.trim()) return;
  const history = loadHistory().filter((q) => q !== query);
  history.unshift(query);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "");
  const [mood, setMood] = useState(searchParams.get("mood") ?? "");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [sort, setSort] = useState<"relevance" | "newest" | "plays">("relevance");
  const [showHistory, setShowHistory] = useState(false);

  const buildUrl = (q: string, g: string, m: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (g) params.set("genre", g);
    if (m) params.set("mood", m);
    return `/search?${params.toString()}`;
  };

  useEffect(() => {
    setHistory(loadHistory());
    // Load available tags
    fetch("/api/tags", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) setAvailableTags(data.tags ?? []);
      })
      .catch(() => {});
  }, []);

  const doSearch = useCallback(async (q: string, g: string, m: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (g) params.set("genre", g);
    if (m) params.set("mood", m);
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/tracks?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        setResults(data.items ?? []);
        if (q) {
          saveHistory(q);
          setHistory(loadHistory());
        }
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const g = searchParams.get("genre") ?? "";
    const m = searchParams.get("mood") ?? "";
    setQuery(q);
    setGenre(g);
    setMood(m);
    if (q || g || m) void doSearch(q, g, m);
  }, [searchParams, doSearch]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (genre) params.set("genre", genre);
    if (mood) params.set("mood", mood);
    router.push(`/search?${params.toString()}`);
  };

  const clearFilters = () => {
    setQuery("");
    setGenre("");
    setMood("");
    router.push("/search");
  };

  const removeHistoryItem = (q: string) => {
    const updated = history.filter((item) => item !== q);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  const safeTags = Array.isArray(availableTags) ? availableTags : [];
  const genres = safeTags.filter((t) => !["chill", "energetic", "melancholic", "upbeat"].includes(t));
  const moods = safeTags.filter((t) => ["chill", "energetic", "melancholic", "upbeat"].includes(t));

  const sortedResults = [...results].sort((a, b) => {
    if (sort === "newest") return b.track.createdAt - a.track.createdAt;
    if (sort === "plays") return b.track.plays - a.track.plays;
    return 0; // relevance is default API order
  });

  return (
    <div className="search-page">
      {/* Hero Search */}
      <div className="search-hero">
        <h1 className="search-hero-title">What do you want to listen to?</h1>
        <form onSubmit={submitSearch} className="search-hero-form">
          <Search size={24} className="search-hero-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, styles, or prompts…"
            className="search-hero-input"
            autoFocus
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="search-hero-clear" aria-label="Clear search">
              <X size={20} />
            </button>
          )}
        </form>
      </div>

      {/* Filters */}
      {(genres.length > 0 || moods.length > 0) && (
        <div className="search-filters-wrap">
          {moods.length > 0 && (
            <div className="search-filter-group">
              <span className="search-filter-label">Vibe</span>
              <div className="search-pills">
                <button type="button" className={`search-pill${!mood ? " active" : ""}`} onClick={() => { setMood(""); router.push(buildUrl(query, genre, "")); }}>All</button>
                {moods.map((m) => (
                  <button key={m} type="button" className={`search-pill${mood === m ? " active" : ""}`} onClick={() => { const next = m === mood ? "" : m; setMood(next); router.push(buildUrl(query, genre, next)); }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
          {genres.length > 0 && (
            <div className="search-filter-group">
              <span className="search-filter-label">Genre</span>
              <div className="search-pills">
                <button type="button" className={`search-pill${!genre ? " active" : ""}`} onClick={() => { setGenre(""); router.push(buildUrl(query, "", mood)); }}>All</button>
                {genres.slice(0, 14).map((g) => (
                  <button key={g} type="button" className={`search-pill${genre === g ? " active" : ""}`} onClick={() => { const next = g === genre ? "" : g; setGenre(next); router.push(buildUrl(query, next, mood)); }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Searches (only show when idle) */}
      {!query && !genre && !mood && history.length > 0 && (
        <div className="search-history-section">
          <div className="search-history-head">
            <h3 className="search-history-title"><Clock size={16} /> Recent searches</h3>
            <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="search-history-clear">Clear all</button>
          </div>
          <div className="search-history-chips">
            {history.map((q) => (
              <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="search-history-chip">
                <span>{q}</span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeHistoryItem(q); }}
                  className="search-history-chip-x"
                  aria-label={`Remove ${q}`}
                >
                  <X size={14} />
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results Area */}
      {(query || genre || mood) && (
        <div className="search-results-area">
          <div className="search-results-head">
            <h2 className="search-results-title">
              {loading ? "Searching…" : sortedResults.length > 0 ? `${sortedResults.length} result${sortedResults.length === 1 ? "" : "s"}` : "No results"}
              {query && <span className="search-results-query"> for “{query}”</span>}
            </h2>
            {sortedResults.length > 0 && (
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="search-sort" aria-label="Sort results">
                <option value="relevance">Most Relevant</option>
                <option value="newest">Newest First</option>
                <option value="plays">Most Played</option>
              </select>
            )}
          </div>

          {loading ? (
            <div className="search-list">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="search-row-skel" />)}
            </div>
          ) : sortedResults.length === 0 ? (
            <div className="search-empty">
              <div className="search-empty-icon"><Search size={40} /></div>
              <h3>We couldn’t find anything for that</h3>
              <p>Try different keywords, or check out what’s trending right now.</p>
              <Link href="/discover" className="btn btn-brand"><TrendingUp size={16} /> Browse trending</Link>
            </div>
          ) : (
            <div className="search-list">
              {sortedResults.map((r) => (
                <SearchTrackRow key={r.track.id} track={r.track} queue={sortedResults.map(x => x.track.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Idle State (no query, no history) */}
      {!query && !genre && !mood && history.length === 0 && (
        <div className="search-idle">
          <p className="search-idle-text">Start typing to search the entire catalog, or use the filters above to explore by vibe and genre.</p>
        </div>
      )}
    </div>
  );
}

function SearchTrackRow({ track, queue }: { track: Track; queue: string[] }) {
  const player = usePlayer();
  const { userById, likeCount } = useStore();
  const { src, fallback } = useTrackThumb(track);
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  const isPlaying = isThis && player.playing;

  return (
    <div className={`search-row${isPlaying ? " is-playing" : ""}`}>
      <div className="search-row-cover" onClick={() => isThis ? player.toggle() : player.playTrack(track, queue)} role="button" tabIndex={0} aria-label={isPlaying ? "Pause" : "Play"}>
        <SmartImg src={src} fallback={fallback} alt="" className="search-row-img" />
        <div className="search-row-play-overlay">
          {isThis && player.buffering ? <Loader2 size={20} className="spin" /> : isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </div>
      </div>
      <div className="search-row-info">
        <Link href={`/track/${track.id}`} className="search-row-title">{track.title}</Link>
        <div className="search-row-meta">
          {artist && <Link href={`/profile/${artist.handle}`} className="search-row-artist">{artist.name}</Link>}
          {track.stylePrompt && <span className="search-row-style">{track.stylePrompt.length > 40 ? track.stylePrompt.slice(0, 40) + '…' : track.stylePrompt}</span>}
        </div>
      </div>
      <div className="search-row-stats">
        <span className="search-row-stat"><Play size={12} fill="currentColor" /> {formatCount(track.plays)}</span>
        <span className="search-row-stat"><Heart size={12} fill="currentColor" /> {formatCount(likeCount(track))}</span>
      </div>
      <div className="search-row-duration">
        {track.duration && !track.live && formatDuration(track.duration)}
      </div>
      <div className="search-row-badge">
        <SourceBadge t={track} compact />
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="empty"><div className="boot-eq on"><i /><i /><i /><i /><i /></div></div>}>
      <SearchInner />
    </Suspense>
  );
}