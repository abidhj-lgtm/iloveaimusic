"use client";

import React from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { usePlayer } from "@/lib/player";

export function PlayButton({ trackId, queue, size = "md", label }: {
  trackId: string; queue?: string[]; size?: "sm" | "md" | "lg"; label?: string;
}) {
  const { state } = useStore();
  const player = usePlayer();
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  const isThis = player.track?.id === trackId;
  const playing = isThis && player.playing;
  const cls = size === "lg" ? "p-play" : "p-play sm";
  return (
    <button
      className={cls}
      onClick={() => (isThis ? player.toggle() : player.playTrack(track, queue ?? [trackId]))}
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      title={playing ? "Pause" : "Play"}
    >
      {isThis && player.buffering ? <Loader2 size={16} className="spin" />
        : playing ? <Pause size={16} fill="currentColor" />
        : <Play size={16} fill="currentColor" className="nudge" />}
      {label && <span className="seo-play-label">{label}</span>}
    </button>
  );
}