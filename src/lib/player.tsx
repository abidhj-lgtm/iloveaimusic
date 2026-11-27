"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Loader2, ArrowUpRight } from "lucide-react";
import type { Track } from "./types";
import { useStore, useToast } from "./store";
import { useMediaUrl, getMediaUrl } from "./idb";
import { ensureTrackAudio } from "./audioGen";
import { loadYouTubeApi, ytThumb, ytWatch } from "./youtube";
import { coverUrl } from "./covers";
import { formatDuration, clamp } from "./utils";

interface PlayerCtx {
  track: Track | null;
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  playTrack: (t: Track, queue?: string[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (frac: number) => void;
}

const PlayerContext = createContext<PlayerCtx | null>(null);
export function usePlayer() {
  const c = useContext(PlayerContext);
  if (!c) throw new Error("player outside provider");
  return c;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const { state, setPrefs, incPlay } = store;
  const prefs = state.prefs;

  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<any>(null);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytReadyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const playToken = useRef(0);
  const trackRef = useRef<Track | null>(null);
  trackRef.current = track;
  const stateRef = useRef(state);
  stateRef.current = state;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  const applyVolume = useCallback(() => {
    const a = audioRef.current;
    if (a) { a.volume = prefsRef.current.volume; a.muted = prefsRef.current.muted; }
    const y = ytRef.current;
    if (y && ytReadyRef.current) {
      try { y.setVolume(Math.round(prefsRef.current.volume * 100)); prefsRef.current.muted ? y.mute() : y.unMute(); } catch { /* not ready */ }
    }
  }, []);

  useEffect(() => { applyVolume(); }, [prefs.muted, prefs.volume, applyVolume]);

  const stopAll = useCallback(() => {
    audioRef.current?.pause();
    try { ytRef.current?.pauseVideo?.(); } catch { /* ignore */ }
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const cur = trackRef.current;
    if (!cur) return;
    const q = queueRef.current.length ? queueRef.current : [cur.id];
    const idx = q.indexOf(cur.id);
    const nextId = q[(idx + dir + q.length) % q.length];
    const t = stateRef.current.tracks.find((x) => x.id === nextId);
    if (t) playTrackRef.current(t, q);
  }, []);

  const playTrack = useCallback(async (t: Track, queue?: string[]) => {
    const token = ++playToken.current;
    if (queue && queue.length) queueRef.current = queue;
    else if (!queueRef.current.includes(t.id)) queueRef.current = [t.id, ...queueRef.current];
    stopAll();
    setTrack(t);
    setPosition(0);
    setDuration(t.duration ?? 0);
    setBuffering(true);
    setPlaying(false);
    incPlay(t.id);

    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: stateRef.current.users.find((u) => u.id === t.userId)?.name ?? "I Love AI Music",
          album: "I Love AI Music"
        });
      }
    } catch { /* unsupported */ }

    if (t.source === "youtube" && t.youtubeId) {
      try {
        const YT = await loadYouTubeApi();
        if (token !== playToken.current) return;
        if (!ytRef.current && ytHostRef.current) {
          ytRef.current = new YT.Player(ytHostRef.current, {
            width: "112", height: "63", videoId: t.youtubeId,
            playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, origin: window.location.origin },
            events: {
              onReady: (e: any) => {
                ytReadyRef.current = true;
                applyVolume();
                e.target.playVideo();
              },
              onStateChange: (e: any) => {
                if (trackRef.current?.source !== "youtube") return;
                if (e.data === 3) { setPlaying(true); setBuffering(false); }
                else if (e.data === 2) { setPlaying(false); setBuffering(false); }
                else if (e.data === 1) { setBuffering(true); }
                else if (e.data === 0) {
                  if (prefsRef.current.repeatOne) { try { ytRef.current.seekTo(0, true); ytRef.current.playVideo(); } catch { /* ignore */ } }
                  else step(1);
                }
              },
              onError: () => {
                setBuffering(false); setPlaying(false);
                toast.push({ kind: "err", msg: "This video can't be embedded — opening on YouTube.", action: { label: "Open", fn: () => window.open(ytWatch(t.youtubeId!), "_blank") } });
              }
            }
          });
        } else if (ytRef.current) {
          ytRef.current.loadVideoById(t.youtubeId);
          applyVolume();
        }
      } catch {
        if (token !== playToken.current) return;
        setBuffering(false); setPlaying(false);
        toast.push({ kind: "err", msg: "YouTube player unavailable here.", action: { label: "Open", fn: () => window.open(ytWatch(t.youtubeId!), "_blank") } });
      }
      return;
    }

    // audio source
    try {
      let key = t.audioKey;
      if (!key && t.preset) key = await ensureTrackAudio(t.id, t.preset);
      if (token !== playToken.current) return;
      if (!key) throw new Error("no-audio");
      const url = await getMediaUrl(key);
      if (token !== playToken.current) return;
      if (!url) throw new Error("no-media");
      const a = audioRef.current!;
      a.src = url;
      a.currentTime = 0;
      applyVolume();
      await a.play();
      if (token !== playToken.current) { a.pause(); return; }
      setPlaying(true);
      setBuffering(false);
    } catch (err: any) {
      if (token !== playToken.current) return;
      setBuffering(false); setPlaying(false);
      if (err?.name === "NotAllowedError") toast.push({ kind: "info", msg: "Tap play to start the music." });
      else toast.push({ kind: "err", msg: "Couldn't load this audio. Try re-uploading the file." });
    }
  }, [applyVolume, incPlay, step, stopAll, toast]);

  const playTrackRef = useRef(playTrack);
  playTrackRef.current = playTrack;

  // audio element events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
    const onEnd = () => {
      if (trackRef.current?.source !== "upload") return;
      if (prefsRef.current.repeatOne) { a.currentTime = 0; a.play().catch(() => {}); }
      else step(1);
    };
    const onPlay = () => { if (trackRef.current?.source === "upload") setPlaying(true); };
    const onPause = () => { if (trackRef.current?.source === "upload") setPlaying(false); };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [step]);

  // progress polling & next track prefetch
  useEffect(() => {
    if (!playing || !track) return;
    
    // Prefetch next track audio if we are in the last 15 seconds
    if (track.source === "upload" && duration > 0 && (duration - position) < 15) {
      const q = queueRef.current.length ? queueRef.current : [track.id];
      const idx = q.indexOf(track.id);
      const nextId = q[(idx + 1 + q.length) % q.length];
      if (nextId !== track.id) {
        const nextTrack = stateRef.current.tracks.find((x) => x.id === nextId);
        if (nextTrack && nextTrack.source === "upload" && nextTrack.audioKey) {
          // Silently fetch and cache the next audio blob in IndexedDB
          getMediaUrl(nextTrack.audioKey).catch(() => {});
        }
      }
    }

    const iv = setInterval(() => {
      if (track.source === "youtube") {
        try {
          const y = ytRef.current;
          if (y && ytReadyRef.current) {
            setPosition(y.getCurrentTime?.() ?? 0);
            const d = y.getDuration?.() ?? 0;
            if (d > 0) setDuration(d);
          }
        } catch { /* ignore */ }
      } else {
        const a = audioRef.current;
        if (a) setPosition(a.currentTime);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [playing, track]);

  // stop if track deleted
  useEffect(() => {
    if (track && !state.tracks.some((t) => t.id === track.id)) {
      stopAll();
      setTrack(null); setPlaying(false); setBuffering(false);
    }
  }, [state.tracks, track, stopAll]);

  // media session actions
  useEffect(() => {
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", () => playTrackRef.current && toggleRef.current());
        navigator.mediaSession.setActionHandler("pause", () => toggleRef.current());
        navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
        navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
      }
    } catch { /* unsupported */ }
  }, [step]);

  const toggle = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    if (t.source === "youtube") {
      try { playing ? ytRef.current?.pauseVideo() : ytRef.current?.playVideo(); } catch { /* ignore */ }
    } else {
      const a = audioRef.current!;
      if (a.paused) a.play().catch(() => toast.push({ kind: "info", msg: "Tap play again to start." }));
      else a.pause();
    }
  }, [playing, toast]);
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  const seek = useCallback((frac: number) => {
    const t = trackRef.current;
    if (!t || t.live) return;
    const f = clamp(frac, 0, 1);
    if (t.source === "youtube") {
      try { const d = ytRef.current?.getDuration?.() ?? 0; if (d > 0) { ytRef.current.seekTo(f * d, true); setPosition(f * d); } } catch { /* ignore */ }
    } else {
      const a = audioRef.current!;
      if (isFinite(a.duration) && a.duration > 0) { a.currentTime = f * a.duration; setPosition(a.currentTime); }
    }
  }, []);

  const live = !!track?.live;
  const frac = duration > 0 ? clamp(position / duration, 0, 1) : 0;
  const artist = track ? state.users.find((u) => u.id === track.userId) : undefined;

  const ctx: PlayerCtx = { track, playing, buffering, position, duration, playTrack, toggle, next: () => step(1), prev: () => step(-1), seek };

  return (
    <PlayerContext.Provider value={ctx}>
      {children}
      <div className={`pbar${track ? "" : " pbar-hidden"}`} aria-label="Music player">
        {!live && (
          <input
            className="pbar-progress range" type="range" min={0} max={1000} value={Math.round(frac * 1000)}
            style={{ ["--p" as any]: `${frac * 100}%` }}
            onChange={(e) => seek(Number(e.target.value) / 1000)}
            aria-label="Seek"
          />
        )}
        {live && <div className="pbar-livebar" />}
        <div className="pbar-inner">
          <div className="p-media">
            <div className={`yt-shell${track?.source === "youtube" ? " on" : ""}`}>
              <div ref={ytHostRef} />
            </div>
            {track && track.source !== "youtube" && <PlayerCover track={track} />}
            {track && (
              <Link href={`/track/${track.id}`} className="p-info">
                <span className="p-title">{track.title}</span>
                <span className="p-artist">{artist?.name ?? "Unknown artist"}</span>
              </Link>
            )}
          </div>
          <div className="p-controls">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous track"><SkipBack size={18} /></button>
            <button className="p-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {buffering ? <Loader2 size={20} className="spin" /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="nudge" />}
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Next track"><SkipForward size={18} /></button>
            <button
              className={`icon-btn repeat-btn${prefs.repeatOne ? " on" : ""}`}
              onClick={() => setPrefs({ repeatOne: !prefs.repeatOne })}
              aria-label={prefs.repeatOne ? "Repeat one on" : "Repeat one off"} title="Repeat this track"
            ><Repeat size={16} /></button>
          </div>
          <div className="p-times">
            {live ? <span className="live-badge"><i />LIVE</span> : (
              <>
                <span>{formatDuration(position)}</span>
                <input
                  className="range p-seek" type="range" min={0} max={1000} value={Math.round(frac * 1000)}
                  style={{ ["--p" as any]: `${frac * 100}%` }}
                  onChange={(e) => seek(Number(e.target.value) / 1000)} aria-label="Seek"
                />
                <span>{formatDuration(duration)}</span>
              </>
            )}
          </div>
          <div className="p-vol">
            <button className="icon-btn" onClick={() => setPrefs({ muted: !prefs.muted })} aria-label={prefs.muted ? "Unmute" : "Mute"}>
              {prefs.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              className="range vol-range" type="range" min={0} max={100} value={Math.round(prefs.volume * 100)}
              style={{ ["--p" as any]: `${prefs.volume * 100}%` }}
              onChange={(e) => setPrefs({ volume: Number(e.target.value) / 100, muted: false })}
              aria-label="Volume"
            />
            {track && (
              <Link href={`/track/${track.id}`} className="icon-btn" aria-label="Open track page"><ArrowUpRight size={18} /></Link>
            )}
          </div>
        </div>
      </div>
    </PlayerContext.Provider>
  );
}

function PlayerCover({ track }: { track: Track }) {
  const media = useMediaUrl(track.thumbKey);
  const src = media ?? coverUrl(track.coverSeed, track.coverPalette);
  return <img className="p-cover" src={src} alt="" />;
}