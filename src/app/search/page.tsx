"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search, X, Clock, Play, Pause, Loader2, Heart, TrendingUp, Music2, AlertTriangle, Sparkles
} from "lucide-react";
import { SourceBadge, useTrackThumb } from "@/components/track-card";
import { usePlayer } from "@/lib/player";
import { useStore } from "@/lib/store";
import { SmartImg, Eq } from "@/components/ui";
import { formatCount, formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";
import "./search.css";

interface Bundle { track: Track }
interface FilterTag { id: string; label: string; count: number; isSeed: boolean; isNew?: boolean }
type SortKey = "relevance" | "plays" | "newest" | "az";

const HISTORY_KEY = "iloveai:search-history";
const BARS = Array.from({ length: 52 }, (_, i) =>
  20 + Math.round(Math.abs(Math.sin(i * 0.55) + Math.sin(i * 0.23) * 0.45) * 60)
);

const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const wordsOf = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(p) ? p.filter((x) => typeof x === "string").slice(0, 10) : [];
  } catch { return []; }
}
function writeHistory(list: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10))); } catch { /* quota */ }
}

/** Prefix-first scoring so "midni" matches "midnight". */
function scoreTrack(t: Track, artistName: string, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const title = norm(t.title);
  const titleWords = wordsOf(t.title);
  const artist = norm(artistName);
  const artistWords = wordsOf(artistName);
  const prompt = norm(t.stylePrompt);

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (title === token) best = 120;
    else if (titleWords.some((w) => w === token)) best = 100;
    else if (titleWords.some((w) => w.startsWith(token))) best = 82;
    else if (title.startsWith(token)) best = 74;
    else if (title.includes(token)) best = 56;

    if (artist) {
      if (artistWords.some((w) => w === token)) best = Math.max(best, 78);
      else if (artistWords.some((w) => w.startsWith(token))) best = Math.max(best, 64);
      else if (artist.includes(token)) best = Math.max(best, 44);
    }
    if (prompt) {
      if (wordsOf(prompt).some((w) => w.startsWith(token))) best = Math.max(best, 38);
      else if (prompt.includes(token)) best = Math.max(best, 26);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total + Math.log10(1 + Math.max(0, t.plays)) * 3;
}

function Mark({ text, terms }: { text: string; terms: string[] }) {
  const usable = terms.filter((t) => t.length >= 2);
  if (!text || usable.length === 0) return <>{text}</>;
  const esc = usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let parts: string[];
  try { parts = text.split(new RegExp(`(${esc.join("|")})`, "ig")); }
  catch { return <>{text}</>; }
  return (
    <>
      {parts.map((p, i) =>
        usable.includes(p.toLowerCase())
          ? <mark key={i} className="sq-mark">{p}</mark>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

function Row({ track, queue, index, terms }: { track: Track; queue: string[]; index: number; terms: string[] }) {
  const player = usePlayer();
  const { userById, likeCount } = useStore();
  const { src, fallback } = useTrackThumb(track);
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  const isPlaying = isThis && player.playing;

  return (
    <div className={`sq-row${isPlaying ? " playing" : ""}`} style={{ animationDelay: `${Math.min(index, 14) * 22}ms` }}>
      <span className="sq-row-num">{isPlaying ? <Eq playing small /> : String(index + 1).padStart(2, "0")}</span>

      <button
        type="button"
        className="sq-row-art"
        onClick={() => (isThis ? player.toggle() : player.playTrack(track, queue))}
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        <SmartImg src={src} fallback={fallback} alt="" />
        <span className="sq-veil">
          {isThis && player.buffering ? <Loader2 size={18} className="spin" />
            : isPlaying ? <Pause size={18} fill="currentColor" />
            : <Play size={18} fill="currentColor" />}
        </span>
      </button>

      <div className="sq-row-main">
        <Link href={`/track/${track.id}`} className="sq-row-title">
          <Mark text={track.title} terms={terms} />
        </Link>
        <div className="sq-row-sub">
          {artist && <Link href={`/profile/${artist.handle}`}><Mark text={artist.name} terms={terms} /></Link>}
          {artist && track.stylePrompt && <span className="sq-dot">·</span>}
          {track.stylePrompt && (
            <i>
              <Mark
                text={track.stylePrompt.length > 54 ? `${track.stylePrompt.slice(0, 54)}…` : track.stylePrompt}
                terms={terms}
              />
            </i>
          )}
        </div>
      </div>

      <div className="sq-row-badge"><SourceBadge t={track} compact /></div>
      <div className="sq-row-stats">
        <span title="Plays"><Play size={11} fill="currentColor" /> {formatCount(track.plays)}</span>
        <span title="Loves"><Heart size={11} fill="currentColor" /> {formatCount(likeCount(track))}</span>
      </div>
      <span className={`sq-row-time${track.live ? " live" : ""}`}>
        {track.live ? "LIVE" : track.duration ? formatDuration(track.duration) : "—"}
      </span>
    </div>
  );
}

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userById } = useStore();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? "");
  const [sort, setSort] = useState<SortKey>("relevance");

  const [serverHits, setServerHits] = useState<Track[]>([]);
  const [pool, setPool] = useState<Track[]>([]);
  const [genres, setGenres] = useState<FilterTag[]>([]);
  const [moods, setMoods] = useState<FilterTag[]>([]);
  const [organic, setOrganic] = useState<FilterTag[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const live = useRef<AbortController | null>(null);
  const selfUrl = useRef("");
  const poolStarted = useRef(false);

  /* ── tags + history ── */
  useEffect(() => {
    setHistory(readHistory());
    fetch("/api/tags", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        if (Array.isArray(d.genres)) setGenres(d.genres.slice(0, 14));
        if (Array.isArray(d.moods)) setMoods(d.moods.slice(0, 10));
        if (Array.isArray(d.organic)) setOrganic(d.organic.slice(0, 8));
      })
      .catch(() => {});
  }, []);

  /* ── candidate pool: minimal, proven params only ── */
  useEffect(() => {
    if (poolStarted.current) return;
    poolStarted.current = true;
    const ac = new AbortController();
    (async () => {
      const seen = new Set<string>();
      const acc: Track[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 6; page++) {
        try {
          const p = new URLSearchParams({ limit: "50" });
          if (cursor) p.set("cursor", cursor);
          const res = await fetch(`/api/tracks?${p}`, { cache: "no-store", signal: ac.signal });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d?.ok || !Array.isArray(d.items) || d.items.length === 0) break;
          for (const b of d.items as Bundle[]) {
            const t = b?.track;
            if (t?.id && !seen.has(t.id)) { seen.add(t.id); acc.push(t); }
          }
          setPool([...acc]);
          cursor = typeof d.nextCursor === "string" ? d.nextCursor
            : typeof d.cursor === "string" ? d.cursor : null;
          if (!cursor) break;
        } catch { break; }
      }
    })();
    return () => ac.abort();
  }, []);

  /* ── URL reflects state, never drives it ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (tag) p.set("tag", tag);
    const qs = p.toString();
    const url = qs ? `/search?${qs}` : "/search";
    selfUrl.current = `${query.trim().toLowerCase()}|${tag}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [query, tag]);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const t = searchParams.get("tag") ?? searchParams.get("genre") ?? "";
    if (`${q.trim().toLowerCase()}|${t}` === selfUrl.current) return;
    setQuery(q); setTag(t);
  }, [searchParams]);

  /* ── the search: debounced server query, merged with prefix matches ── */
  const runSearch = useCallback(async (q: string, t: string) => {
    const term = q.trim();
    const id = ++reqId.current;
    live.current?.abort();
    live.current = null;

    if (!term && !t) {
      setServerHits([]); setError(null); setLoading(false); setSettled("");
      return;
    }

    setLoading(true);
    setError(null);

    const p = new URLSearchParams({ limit: "50" });
    if (term) p.set("q", term);
    if (t) p.set("q", t);

    const ac = new AbortController();
    live.current = ac;

    try {
      const res = await fetch(`/api/tracks?${p}`, { cache: "no-store", signal: ac.signal });
      const d = await res.json().catch(() => ({}));
      if (id !== reqId.current) return;
      if (res.ok && d?.ok && Array.isArray(d.items)) {
        setServerHits(d.items.map((b: Bundle) => b?.track).filter((x: Track) => x?.id));
        setSettled(term || t);
        if (term.length >= 3) {
          const next = [term, ...readHistory().filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 10);
          writeHistory(next); setHistory(next);
        }
      } else if (res.status === 429) {
        setServerHits([]);
        setSettled(term || t);
      } else {
        setServerHits([]);
        setSettled(term || t);
        if (pool.length === 0) setError(d?.error ?? "Search is unavailable right now.");
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      if (id !== reqId.current) return;
      setServerHits([]);
      setSettled(term || t);
      if (pool.length === 0) setError("Could not reach the server. Check your connection.");
    } finally {
      if (id === reqId.current) { setLoading(false); live.current = null; }
    }
  }, [pool.length]);

  useEffect(() => {
    const term = query.trim();
    if (!term && !tag) { void runSearch("", ""); return; }
    const timer = setTimeout(() => { void runSearch(query, tag); }, 220);
    return () => clearTimeout(timer);
  }, [query, tag, runSearch]);

  useEffect(() => () => live.current?.abort(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "Escape" && query) { setQuery(""); inputRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [query]);

  /* ── merge: server relevance first, then local prefix matches ── */
  const tokens = useMemo(() => wordsOf(query), [query]);

  const rows = useMemo(() => {
    const merged = new Map<string, { track: Track; score: number }>();

    serverHits.forEach((t, i) => {
      if (t?.id) merged.set(t.id, { track: t, score: 10000 - i });
    });

    if (tokens.length > 0 || tag) {
      const tagToken = norm(tag);
      for (const t of pool) {
        if (!t?.id || merged.has(t.id)) continue;
        if (tagToken && !norm(`${t.stylePrompt} ${t.title}`).includes(tagToken)) continue;
        const s = tokens.length > 0
          ? scoreTrack(t, userById(t.userId)?.name ?? "", tokens)
          : 1 + Math.log10(1 + t.plays);
        if (s > 0) merged.set(t.id, { track: t, score: s });
      }
    }

    const arr = [...merged.values()];
    arr.sort((a, b) => {
      switch (sort) {
        case "plays": return b.track.plays - a.track.plays;
        case "newest": return b.track.createdAt - a.track.createdAt;
        case "az": return a.track.title.localeCompare(b.track.title);
        default: return b.score - a.score || b.track.plays - a.track.plays;
      }
    });
    return arr.map((x) => x.track);
  }, [serverHits, pool, tokens, tag, sort, userById]);

  const suggestions = useMemo(() => {
    if (rows.length > 0 || tokens.length === 0) return [];
    const stem = tokens[0].slice(0, 3);
    if (stem.length < 2) return [];
    const out: Track[] = [];
    const seen = new Set<string>();
    for (const t of pool) {
      if (out.length >= 5) break;
      if (wordsOf(t.title).some((w) => w.startsWith(stem)) && !seen.has(t.id)) {
        seen.add(t.id); out.push(t);
      }
    }
    return out;
  }, [rows.length, tokens, pool]);

  const queue = useMemo(() => rows.map((t) => t.id), [rows]);
  const active = Boolean(query.trim() || tag);
  const busy = loading && rows.length === 0;

  return (
    <div className="sq">
      <div className="sq-aurora" aria-hidden><i /><i /><i /></div>

      <section className="sq-stage">
        <div className="sq-stage-body">
          <p className="sq-eyebrow"><Sparkles size={11} /> Catalog search</p>
          <h1 className="sq-title">Find your <em>frequency</em></h1>
          <p className="sq-lede">
            Type anything — results arrive as you go.
          </p>

          <form className="sq-field" onSubmit={(e) => { e.preventDefault(); void runSearch(query, tag); }}>
            <span className="sq-field-icon">
              {loading ? <Loader2 size={19} className="spin" /> : <Search size={19} />}
            </span>
            <input
              ref={inputRef}
              className="sq-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracks, artists, or style prompts…"
              aria-label="Search the catalog"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" className="sq-clear" aria-label="Clear search"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}><X size={16} /></button>
            )}
          </form>

          <div className={`sq-spectrum${loading ? " scanning" : ""}`} aria-hidden>
            {BARS.map((h, i) => <i key={i} style={{ ["--h" as any]: h, ["--i" as any]: i }} />)}
          </div>
        </div>
      </section>

      {(() => {
        const hasAnyTags = genres.length > 0 || moods.length > 0 || organic.length > 0;
        if (!hasAnyTags) {
          return (
            <div className="sq-filter-empty">
              <p>Filters will appear as tracks are added to the catalog.</p>
            </div>
          );
        }
        return (
          <div className="sq-filter-groups">
            {moods.length > 0 && (
              <div className="sq-filter-group">
                <span className="sq-filter-label">Vibe</span>
                <div className="sq-tags">
                  <button type="button" className={`sq-chip${!tag ? " on" : ""}`} onClick={() => setTag("")}>All</button>
                  {moods.map((m) => (
                    <button key={m.id} type="button" className={`sq-chip${tag === m.id ? " on" : ""}`}
                      onClick={() => setTag(m.id === tag ? "" : m.id)}
                      title={`${m.count} track${m.count === 1 ? "" : "s"}`}>
                      {m.label}
                      {m.count > 0 && <span className="sq-chip-count">{m.count}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {genres.length > 0 && (
              <div className="sq-filter-group">
                <span className="sq-filter-label">Genre</span>
                <div className="sq-tags">
                  <button type="button" className={`sq-chip${!tag ? " on" : ""}`} onClick={() => setTag("")}>All</button>
                  {genres.map((g) => (
                    <button key={g.id} type="button" className={`sq-chip${tag === g.id ? " on" : ""}`}
                      onClick={() => setTag(g.id === tag ? "" : g.id)}
                      title={`${g.count} track${g.count === 1 ? "" : "s"}`}>
                      {g.label}
                      {g.count > 0 && <span className="sq-chip-count">{g.count}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {organic.length > 0 && (
              <div className="sq-filter-group">
                <span className="sq-filter-label">More</span>
                <div className="sq-tags">
                  {organic.map((o) => (
                    <button key={o.id} type="button" className={`sq-chip${tag === o.id ? " on" : ""}${o.isNew ? " new" : ""}`}
                      onClick={() => setTag(o.id === tag ? "" : o.id)}
                      title={`${o.count} track${o.count === 1 ? "" : "s"}`}>
                      {o.label}
                      {o.isNew && <span className="sq-chip-new">NEW</span>}
                      <span className="sq-chip-count">{o.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!active && history.length > 0 && (
        <div className="sq-recent">
          <div className="sq-recent-head">
            <h3><Clock size={12} /> Recent</h3>
            <button type="button" onClick={() => { writeHistory([]); setHistory([]); }}>Clear</button>
          </div>
          <div className="sq-recent-chips">
            {history.map((q) => (
              <span key={q} className="sq-recent-chip">
                <button type="button" className="sq-recent-go" onClick={() => setQuery(q)}>{q}</button>
                <button type="button" className="sq-recent-x" aria-label={`Remove ${q}`}
                  onClick={() => { const n = history.filter((x) => x !== q); writeHistory(n); setHistory(n); }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {active ? (
        <>
          <div className="sq-head">
            <span className="sq-count">{busy ? <Loader2 size={26} className="spin" /> : rows.length}</span>
            <span className="sq-count-label">
              {rows.length === 1 ? "track" : "tracks"}
              {settled && <> for <b>“{settled}”</b></>}
              {tag && <em className="sq-tag-pill">{tag}</em>}
            </span>
            <div className="sq-head-tools">
              {rows.length > 1 && (
                <select className="sq-sort" value={sort} aria-label="Sort results"
                  onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="relevance">Best match</option>
                  <option value="plays">Most played</option>
                  <option value="newest">Freshest</option>
                  <option value="az">Title A–Z</option>
                </select>
              )}
              <button type="button" className="sq-reset" onClick={() => { setQuery(""); setTag(""); }}>Clear</button>
            </div>
          </div>

          {busy ? (
            <div className="sq-list">
              {Array.from({ length: 7 }).map((_, i) => <div className="sq-skel" key={i}><b /><i /><u /></div>)}
            </div>
          ) : rows.length > 0 ? (
            <div className={`sq-list${loading ? " refreshing" : ""}`}>
              {rows.map((t, i) => <Row key={t.id} track={t} queue={queue} index={i} terms={tokens} />)}
            </div>
          ) : error ? (
            <div className="sq-panel warn">
              <div className="sq-panel-ico"><AlertTriangle size={26} /></div>
              <h3>Search hit a snag</h3>
              <p>{error}</p>
              <div className="sq-panel-actions">
                <button type="button" className="sq-btn primary" onClick={() => void runSearch(query, tag)}>Try again</button>
                <Link href="/discover" className="sq-btn"><TrendingUp size={15} /> Discover</Link>
              </div>
            </div>
          ) : (
            <div className="sq-panel">
              <div className="sq-panel-ico"><Search size={26} /></div>
              <h3>Nothing on that frequency</h3>
              <p>No track matched “{settled || query.trim()}”. Try a shorter word or browse what’s trending.</p>
              {suggestions.length > 0 && (
                <div className="sq-suggest">
                  <span>Closest titles</span>
                  {suggestions.map((t) => (
                    <button key={t.id} type="button" onClick={() => setQuery(wordsOf(t.title)[0] ?? t.title)}>
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="sq-panel-actions">
                <Link href="/discover" className="sq-btn primary"><TrendingUp size={15} /> Browse trending</Link>
                <button type="button" className="sq-btn" onClick={() => { setQuery(""); setTag(""); }}>
                  <X size={15} /> Start over
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="sq-panel">
          <div className="sq-panel-ico"><Music2 size={26} /></div>
          <h3>Start typing</h3>
          <p>Search the whole catalog by track name, artist, or the prompt that made it. Or pick a tag above.</p>
          <div className="sq-panel-actions">
            <Link href="/discover" className="sq-btn primary"><TrendingUp size={15} /> What’s trending</Link>
            <Link href="/create" className="sq-btn"><Music2 size={15} /> Post a track</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="sq">
        <div className="sq-list">
          {Array.from({ length: 7 }).map((_, i) => <div className="sq-skel" key={i}><b /><i /><u /></div>)}
        </div>
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}