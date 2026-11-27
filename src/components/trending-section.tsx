"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { TrackCard, SkeletonCard } from "@/components/track-card";

export function TrendingSection() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trending?limit=12", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok) setTracks(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="trending-section">
        <h2 className="section-title">
          <TrendingUp size={20} /> Trending Now
        </h2>
        <div className="feed-grid">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="trending-section">
      <h2 className="section-title">
        <TrendingUp size={20} /> Trending Now
      </h2>
      <div className="feed-grid">
        {tracks.slice(0, 12).map((item) => (
          <TrackCard key={item.track.id} track={item.track} />
        ))}
      </div>
    </section>
  );
}