"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { TrackCard, SkeletonCard } from "@/components/track-card";
import { SilentErrorBoundary } from "@/components/ui";

function SimilarTracksInner({ trackId }: { trackId: string }) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tracks/${trackId}/similar?limit=6`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) setTracks(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trackId]);

  if (loading) {
    return (
      <section className="similar-section">
        <h2 className="section-title">
          <Music2 size={20} /> Similar Tracks
        </h2>
        <div className="feed-grid">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="similar-section">
      <h2 className="section-title">
        <Music2 size={20} /> Similar Tracks
      </h2>
      <div className="feed-grid">
        {tracks.map((item) => (
          <TrackCard key={item.track.id} track={item.track} />
        ))}
      </div>
    </section>
  );
}

export function SimilarTracks(props: { trackId: string }) {
  return (
    <SilentErrorBoundary>
      <SimilarTracksInner {...props} />
    </SilentErrorBoundary>
  );
}