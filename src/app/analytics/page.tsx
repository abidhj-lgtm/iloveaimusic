"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, Play, Heart, MessageCircle, Disc3, Download, Headphones, Shield, Eye, Users, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatCount } from "@/lib/utils";

interface SeriesPoint { day: string; plays: number; unique_listeners: number; views?: number; profile_views?: number }
interface TopTrack { track_id: string; title: string; plays: number; unique_listeners: number; views?: number; conversionRate?: string }
interface Totals { tracks: number; plays: number; likes: number; comments: number; profileViews?: number; trackViews?: number; totalUniqueVisitors?: number }

export default function AnalyticsPage() {
  const { currentUser } = useStore();
  const [days, setDays] = useState(30);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [top, setTop] = useState<TopTrack[]>([]);
  const [trafficTrend, setTrafficTrend] = useState<{ date: string; views: number; unique: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!currentUser) { setIsStaff(false); return; }
    let alive = true;
    fetch("/api/admin/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setIsStaff(!!d?.isAdmin); })
      .catch(() => { if (alive) setIsStaff(false); });
    return () => { alive = false; };
  }, [currentUser]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch existing analytics (plays, likes, comments)
      const res = await fetch(`/api/analytics/user?days=${days}`, { credentials: "same-origin", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      
      // Fetch traffic analytics (views, unique visitors)
      const trafficRes = await fetch(`/api/analytics/creator`, { credentials: "same-origin", cache: "no-store" });
      const trafficData = await trafficRes.json().catch(() => ({}));
      
      if (d?.ok) {
        // Merge traffic data into totals
        const mergedTotals: Totals = {
          ...d.totals,
          profileViews: trafficData?.summary?.profileViews ?? 0,
          trackViews: trafficData?.summary?.totalTrackViews ?? 0,
          totalUniqueVisitors: trafficData?.summary?.totalTrackUnique ?? 0
        };
        
        setTotals(mergedTotals);
        setSeries(d.series ?? []);
        
        // Merge traffic data into top tracks
        const mergedTop = (d.topTracks ?? []).map((t: TopTrack) => {
          const trafficTrack = trafficData?.topTracks?.find((tt: any) => tt.id === t.track_id);
          return {
            ...t,
            views: trafficTrack?.views ?? 0,
            conversionRate: trafficTrack?.conversionRate ?? "0%"
          };
        });
        setTop(mergedTop);
        
        // Set traffic trend
        setTrafficTrend(trafficData?.trend ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [days]);

  useEffect(() => { if (currentUser) void load(); }, [currentUser, load]);

  if (!currentUser) {
    return <div className="empty"><div className="empty-icon"><BarChart3 size={30} /></div><h3>Log in to see your analytics</h3><p>Plays, loves and your top tracks, all in one place.</p></div>;
  }

  const max = Math.max(1, ...series.map((p) => p.plays));

  return (
    <div className="an-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Creator analytics</h1>
          <p className="page-sub">How your music is landing.</p>
        </div>
        <div className="an-range" role="tablist" aria-label="Date range">
          {[7, 30, 90].map((d) => (
            <button key={d} role="tab" aria-selected={days === d} className={`an-range-btn${days === d ? " active" : ""}`} onClick={() => setDays(d)}>{d}d</button>
          ))}
          <button 
            type="button" 
            className="btn btn-ghost btn-sm" 
            onClick={() => window.open(`/api/analytics/user/export?days=${days}`, "_blank")}
            title="Download CSV"
          >
            <Download size={15} /> Export CSV
          </button>
          {isStaff && (
            <Link href="/admin" className="btn btn-brand btn-sm" title="Open the staff console">
              <Shield size={15} /> Staff console
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="pl-loading big"><Loader2 size={22} className="spin" /> Crunching the numbers…</div>
      ) : (
        <>
          <div className="an-cards">
            <div className="an-card"><Disc3 size={18} /><span className="an-card-num">{formatCount(totals?.tracks ?? 0)}</span><em>Tracks</em></div>
            <div className="an-card an-play"><Play size={18} /><span className="an-card-num">{formatCount(totals?.plays ?? 0)}</span><em>Plays</em></div>
            <div className="an-card an-love"><Heart size={18} /><span className="an-card-num">{formatCount(totals?.likes ?? 0)}</span><em>Loves</em></div>
            <div className="an-card an-talk"><MessageCircle size={18} /><span className="an-card-num">{formatCount(totals?.comments ?? 0)}</span><em>Comments</em></div>
          </div>

          {/* Traffic Analytics Cards */}
          <div className="an-cards">
            <div className="an-card an-views">
              <Eye size={18} />
              <span className="an-card-num">{formatCount(totals?.profileViews ?? 0)}</span>
              <em>Profile Views</em>
            </div>
            <div className="an-card an-views">
              <Eye size={18} />
              <span className="an-card-num">{formatCount(totals?.trackViews ?? 0)}</span>
              <em>Track Views</em>
            </div>
            <div className="an-card an-unique">
              <Users size={18} />
              <span className="an-card-num">{formatCount(totals?.totalUniqueVisitors ?? 0)}</span>
              <em>Unique Visitors</em>
            </div>
            <div className="an-card an-conversion">
              <TrendingUp size={18} />
              <span className="an-card-num">
                {totals?.trackViews && totals?.totalUniqueVisitors 
                  ? ((totals.plays / totals.totalUniqueVisitors) * 100).toFixed(1) + "%"
                  : "0%"}
              </span>
              <em>Conversion Rate</em>
            </div>
          </div>

          <section className="an-panel">
            <h2 className="an-panel-title">Plays over the last {days} days</h2>
            {series.length === 0 ? (
              <p className="an-nodata">No plays in this window yet. Share a track and watch this fill in.</p>
            ) : (
              <div className="an-chart" role="img" aria-label="Bar chart of daily plays">
                {series.map((p) => (
                  <div key={p.day} className="an-bar-col" title={`${p.day}: ${p.plays} plays · ${p.unique_listeners} listeners`}>
                    <div className="an-bar" style={{ height: `${Math.max(4, (p.plays / max) * 100)}%` }} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Traffic Trend Chart */}
          {trafficTrend.length > 0 && (
            <section className="an-panel">
              <h2 className="an-panel-title">Traffic trend (views over the last {days} days)</h2>
              <div className="an-chart" role="img" aria-label="Bar chart of daily views">
                {(() => {
                  const maxViews = Math.max(1, ...trafficTrend.map((p) => p.views));
                  return trafficTrend.map((p) => (
                    <div key={p.date} className="an-bar-col" title={`${p.date}: ${p.views} views · ${p.unique} unique`}>
                      <div className="an-bar an-bar-traffic" style={{ height: `${Math.max(4, (p.views / maxViews) * 100)}%` }} />
                    </div>
                  ));
                })()}
              </div>
            </section>
          )}

          <section className="an-panel">
            <h2 className="an-panel-title">Top tracks</h2>
            {top.length === 0 ? (
              <p className="an-nodata">Nothing here yet.</p>
            ) : (
              <ol className="an-top">
                {top.map((t, i) => (
                  <li key={t.track_id} className="an-top-row">
                    <span className="an-top-rank">{i + 1}</span>
                    <Link href={`/track/${t.track_id}`} className="an-top-title">{t.title}</Link>
                    <span className="an-top-stats">
                      <Eye size={13} /> {formatCount(t.views ?? 0)} views ·
                      <Play size={13} /> {formatCount(t.plays)} plays ·
                      <span className="an-listener-badge"><Headphones size={12} /> {formatCount(t.unique_listeners)} listeners</span>
                      {t.conversionRate && (
                        <span className="an-conversion-badge" title="Conversion rate (plays / unique visitors)">
                          <TrendingUp size={12} /> {t.conversionRate}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}