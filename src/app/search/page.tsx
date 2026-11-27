"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X, Clock, TrendingUp, Filter } from "lucide-react";
import { TrackCard, SkeletonCard } from "@/components/track-card";
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

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "");
  const [mood, setMood] = useState(searchParams.get("mood") ?? "");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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

  const genres = availableTags.filter((t) => !["chill", "energetic", "melancholic", "upbeat"].includes(t));
  const moods = availableTags.filter((t) => ["chill", "energetic", "melancholic", "upbeat"].includes(t));

  return (
    <div className="search-page">
      <div className="search-header">
        <h1 className="search-title">
          <Search size={28} /> Advanced Search
        </h1>
        <form onSubmit={submitSearch} className="search-form">
          <div className="search-input-wrap">
            <Search size={20} className="search-input-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracks, artists, styles…"
              className="search-input"
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="search-clear">
                <X size={18} />
              </button>
            )}
          </div>
          <div className="search-filters">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="search-select">
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={mood} onChange={(e) => setMood(e.target.value)} className="search-select">
              <option value="">All moods</option>
              {moods.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-brand">
              <Search size={16} /> Search
            </button>
            {(query || genre || mood) && (
              <button type="button" onClick={clearFilters} className="btn btn-ghost">
                <X size={16} /> Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {history.length > 0 && (
        <div className="search-history">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="search-history-toggle"
          >
            <Clock size={16} /> Recent searches ({history.length})
          </button>
          {showHistory && (
            <div className="search-history-list">
              {history.map((q) => (
                <div key={q} className="search-history-item">
                  <Link href={`/search?q=${encodeURIComponent(q)}`} className="search-history-link">
                    {q}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeHistoryItem(q)}
                    className="search-history-remove"
                    aria-label={`Remove ${q} from history`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="search-history-clear">
                Clear all history
              </button>
            </div>
          )}
        </div>
      )}

      <div className="search-results">
        {loading ? (
          <div className="feed-grid">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : results.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Search size={30} /></div>
            <h3>No tracks found</h3>
            <p>Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            <div className="search-results-count">
              {results.length} track{results.length === 1 ? "" : "s"} found
            </div>
            <div className="feed-grid">
              {results.map((r) => (
                <TrackCard key={r.track.id} track={r.track} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}