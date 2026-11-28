"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Heart, MessageCircle, UserPlus, ListMusic, Info, CheckCheck, Inbox } from "lucide-react";
import { avatarUrl } from "@/lib/covers";
import { useStore } from "@/lib/store";
import { SilentErrorBoundary } from "@/components/ui";

interface NotifActor { id: string; name: string; handle: string; avatarPalette: number }
interface NotifTrack { id: string; title: string }
interface Notif {
  id: string; kind: string; createdAt: string; readAt: string | null;
  actor: NotifActor | null; track: NotifTrack | null; playlistId: string | null; commentId: string | null;
}

const KIND: Record<string, { Icon: React.ComponentType<{ size?: number; className?: string }>; hue: string }> = {
  like:         { Icon: Heart,         hue: "var(--magenta)" },
  comment:      { Icon: MessageCircle, hue: "var(--violet)" },
  follow:       { Icon: UserPlus,      hue: "var(--cyan)" },
  playlist_add: { Icon: ListMusic,     hue: "var(--lime)" },
  system:       { Icon: Info,          hue: "var(--amber)" }
};

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function verb(n: Notif): string {
  const who = n.actor?.name ?? "Someone";
  const what = n.track?.title ? `“${n.track.title}”` : "your track";
  switch (n.kind) {
    case "like": return `loved ${what}`;
    case "comment": return `commented on ${what}`;
    case "follow": return "started following you";
    case "playlist_add": return `added ${what} to a playlist`;
    default: return "sent you an update";
  }
}

function NotificationBellInner() {
  const router = useRouter();
  const { currentUser, serverMode } = useStore();
  const enabled = !!currentUser && serverMode === "supabase";
  const wrap = useRef<HTMLDivElement>(null);
  const { notificationCount, refreshNotifications } = useStore();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const unread = notificationCount;

  const load = useCallback(async (reset = true) => {
    if (!enabled) return;
    try {
      const url = reset
        ? "/api/notifications?limit=20"
        : `/api/notifications?cursor=${encodeURIComponent(nextCursor ?? "")}&limit=20`;
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        if (reset) {
          setItems(data.items ?? []);
        } else {
          setItems((prev) => [...prev, ...(data.items ?? [])]);
        }
        setNextCursor(data.nextCursor ?? null);
        setHasMore(!!data.hasMore);
      }
    } catch { /* silent */ }
  }, [enabled, nextCursor]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!enabled) return;
    void load();
    const iv = setInterval(load, 30000);
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load, enabled]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const markAll = useCallback(async () => {
    setItems((p) => p.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    void refreshNotifications();
    try { await fetch("/api/notifications/mark-all-read", { method: "POST", credentials: "same-origin" }); } catch { /* ignore */ }
  }, []);

  const openItem = useCallback(async (n: Notif) => {
    setOpen(false);
    if (!n.readAt) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void refreshNotifications();
      fetch(`/api/notifications/${n.id}/read`, { method: "PATCH", credentials: "same-origin" }).catch(() => undefined);
    }
    if (n.track) router.push(`/track/${n.track.id}${n.commentId ? "#comments" : ""}`);
    else if (n.kind === "follow" && n.actor) router.push(`/profile/${n.actor.handle}`);
  }, [router]);

  if (!enabled) return null;

  return (
    <div className="notif-wrap" ref={wrap}>
      <button
        type="button"
        className={`notif-bell${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button type="button" className="notif-markall" onClick={markAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">
                <Inbox size={26} />
                <p>Nothing yet. When someone loves or comments on your music, it lands here.</p>
              </div>
            ) : (
              <>
                {items.map((n) => {
                  const meta = KIND[n.kind] ?? KIND.system;
                  const { Icon } = meta;
                  return (
                    <button key={n.id} type="button" className={`notif-item${n.readAt ? "" : " unread"}`} onClick={() => openItem(n)}>
                      <span className="notif-avatar">
                        {n.actor ? (
                          <img src={avatarUrl(n.actor.name, n.actor.avatarPalette)} alt="" />
                        ) : (
                          <span className="notif-avatar-fallback" />
                        )}
                        <span className="notif-kind" style={{ color: meta.hue, borderColor: meta.hue }}><Icon size={11} /></span>
                      </span>
                      <span className="notif-body">
                        <span className="notif-text">
                          {n.actor && <strong>{n.actor.name} </strong>}
                          {verb(n)}
                        </span>
                        <span className="notif-meta">{ago(n.createdAt)}</span>
                      </span>
                      {!n.readAt && <span className="notif-dot" aria-hidden />}
                    </button>
                  );
                })}
                {hasMore && (
                  <button
                    type="button"
                    className="notif-load-more"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationBell() {
  return (
    <SilentErrorBoundary>
      <NotificationBellInner />
    </SilentErrorBoundary>
  );
}