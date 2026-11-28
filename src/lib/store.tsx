"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { State, User, Track, TrackInput, Comment, Prefs } from "./types";
import { uid } from "./utils";
import { buildSeed } from "./seed";
import { CATALOG_ARTISTS } from "./catalog";
import { getMedia } from "./idb";

const KEY = "ilistenai:v3";
const LEGACY_KEYS = ["ilistenai:v2", "ilistenai:v1"];
const MIGRATED_FLAG = "ilistenai:imported";

export interface ToastItem {
  id: string; kind: "ok" | "err" | "info"; msg: string;
  action?: { label: string; fn: () => void }; leaving?: boolean;
}
interface ToastCtx { push: (t: Omit<ToastItem, "id">) => void }
const ToastContext = createContext<ToastCtx | null>(null);
export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error("toast outside provider");
  return c;
}

interface ServerUser {
  id: string; name: string; handle: string; email?: string; verified: boolean;
  provider: "email" | "google" | "demo"; bio: string; avatarPalette: number; createdAt: number;
}
interface DevMail {
  id: string; to: string; token: string; kind: "verify" | "reset";
  sentAt: number; expiresAt: number; used: boolean;
}
interface Bundle { track: Track; comments: Comment[]; likedByMe: boolean; savedByMe: boolean }

const toUser = (s: ServerUser): User => ({
  id: s.id, name: s.name, handle: s.handle, email: s.email ?? "",
  verified: s.verified, provider: s.provider, bio: s.bio,
  avatarPalette: s.avatarPalette, createdAt: s.createdAt
});

const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds
const LOCAL_CACHE_KEY = "ilistenai:api-cache";
const LOCAL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getLocalCache(): Record<string, { data: any; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalCache(key: string, data: any) {
  if (typeof window === "undefined") return;
  try {
    const cache = getLocalCache();
    cache[key] = { data, timestamp: Date.now() };
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded or other error — ignore
  }
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const isGet = !init || init.method === "GET" || !init.method;
  const cacheKey = isGet ? path : null;

  if (!isGet) {
    // Clear cache on mutations to prevent stale reads immediately after
    apiCache.clear();
  } else if (cacheKey) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(path, {
      ...init,
      headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: isGet ? "default" : "no-store"
    });
    const data = await res.json().catch(() => ({}));
    const result = { ok: res.ok && data?.ok !== false, ...data };
    
    if (cacheKey && result.ok) {
      apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      // Also cache in localStorage for offline fallback
      setLocalCache(cacheKey, result);
    }
    return result;
  } catch (err) {
    // Network error — try to return cached data from localStorage
    if (cacheKey) {
      const localCache = getLocalCache();
      const cached = localCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < LOCAL_CACHE_TTL) {
        console.warn(`[api] Network error, returning cached data for ${cacheKey}`);
        return { ...cached.data, _fromCache: true };
      }
    }
    return { ok: false, error: "Can't reach the server. Is the dev terminal still running?", code: "network" };
  }
}

type Result = { ok: true } | { ok: false; error: string; code?: string };

interface StoreCtx {
  state: State;
  currentUser: User | null;
  serverMode: "local" | "supabase";
  mailMode: "dev" | "resend";
  googleEnabled: boolean;
  syncing: boolean;
  signup: (name: string, email: string, pass: string) => Promise<Result>;
  login: (email: string, pass: string) => Promise<Result>;
  demoLogin: () => void;
  logout: () => void;
  verifyToken: (token: string) => Promise<Result>;
  resendVerification: (email: string) => Promise<Result>;
  refreshAuth: () => Promise<void>;
  refreshContent: () => Promise<void>;
  addTrack: (input: TrackInput) => string;
  updateTrack: (id: string, input: TrackInput) => void;
  deleteTrack: (id: string) => (() => void) | null;
  toggleLike: (trackId: string) => void;
  toggleSave: (trackId: string) => void;
  toggleFollow: (targetId: string) => void;
  addComment: (trackId: string, text: string) => void;
  deleteComment: (id: string) => (() => void) | null;
  incPlay: (trackId: string) => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "bio" | "avatarPalette">>) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  likeCount: (t: Track) => number;
  isLiked: (trackId: string) => boolean;
  isSaved: (trackId: string) => boolean;
  isFollowing: (targetId: string) => boolean;
  userById: (id: string) => User | undefined;
  commentsFor: (trackId: string) => Comment[];
  notificationCount: number;
  refreshNotifications: () => Promise<void>;
}

const StoreContext = createContext<StoreCtx | null>(null);
export function useStore() {
  const c = useContext(StoreContext);
  if (!c) throw new Error("store outside provider");
  return c;
}

function BootSplash({ note }: { note?: string }) {
  return (
    <div className="boot">
      <div className="boot-mark"><span className="boot-eq"><i /><i /><i /><i /><i /></span></div>
      <div className="boot-name">I Love <em>AI Music</em></div>
      <div className="boot-sub">{note ?? "Connecting to your studio…"}</div>
    </div>
  );
}

function mergeUsers(profiles: User[]): User[] {
  const map = new Map<string, User>();
  for (const a of CATALOG_ARTISTS) map.set(a.id, a);
  for (const p of profiles) {
    const clash = [...map.values()].find((u) => u.id !== p.id && u.handle === p.handle);
    if (clash) map.delete(clash.id);
    map.set(p.id, p);
  }
  return [...map.values()];
}

function applyBundles(base: State, bundles: Bundle[], collections: { liked: string[]; saved: string[]; following: string[] }, viewerId: string | null): State {
  const tracks = bundles.map((b) => b.track).sort((a, b) => b.createdAt - a.createdAt);
  const comments = bundles.flatMap((b) => b.comments);
  const likes = viewerId ? collections.liked.map((trackId) => ({ userId: viewerId, trackId, createdAt: Date.now() })) : [];
  const saves = viewerId ? collections.saved.map((trackId) => ({ userId: viewerId, trackId, createdAt: Date.now() })) : [];
  const follows = viewerId ? collections.following.map((targetId) => ({ followerId: viewerId, targetId })) : [];
  return { ...base, tracks, comments, likes, saves, follows };
}

async function uploadLocalBlob(
  kind: "audio" | "cover",
  key: string,
  onProgress?: (percent: number) => void
): Promise<{ path: string; mime: string; bytes: number } | null> {
  if (key.startsWith("/api/media/")) {
    const parts = decodeURIComponent(key.split("/").pop() ?? "");
    return parts ? { path: parts, mime: "", bytes: 0 } : null;
  }

  const blob = await getMedia(key);
  if (!blob) return null;

  if (blob.size <= 4 * 1024 * 1024) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", new File([blob], key.replace(/[^a-zA-Z0-9._-]/g, "_"), {
      type: blob.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg")
    }));
    const res = await api("/api/uploads", { method: "POST", body: form });
    return res.ok ? { path: res.path, mime: res.mime, bytes: res.bytes } : null;
  }

  const fileName = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  const signRes = await api("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      kind,
      size: blob.size,
      fileName,
      mimeType: blob.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg")
    })
  });

  if (!signRes.ok || !signRes.signedUrl) {
    console.error("Sign failed:", signRes);
    return null;
  }

  try {
    const xhr = new XMLHttpRequest();
    
    return await new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            path: signRes.objectPath,
            mime: blob.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg"),
            bytes: blob.size
          });
        } else {
          console.error("Upload failed:", xhr.status, xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        console.error("Upload network error");
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was cancelled"));
      });

      xhr.open("PUT", signRes.signedUrl);
      xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
      xhr.setRequestHeader("Authorization", `Bearer ${signRes.apiKey}`);
      xhr.setRequestHeader("apikey", signRes.apiKey);
      xhr.send(blob);
    });
  } catch (err) {
    console.error("Upload exception:", err);
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [bootNote, setBootNote] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [meta, setMeta] = useState<{ mode: "local" | "supabase"; mail: "dev" | "resend"; google: boolean }>({ mode: "local", mail: "dev", google: false });
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const playThrottle = useRef(new Map<string, number>());
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    const currentUser = state?.users.find((u) => u.id === state.sessionUserId) ?? null;
    if (!currentUser || meta.mode !== "supabase") { setNotificationCount(0); return; }
    try {
      const res = await api("/api/notifications/unread-count");
      if (res.ok) setNotificationCount(res.unread ?? 0);
    } catch { /* ignore */ }
  }, [state, meta.mode]);

  useEffect(() => {
    void refreshNotifications();
    const iv = setInterval(refreshNotifications, 30000);
    return () => clearInterval(iv);
  }, [refreshNotifications]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = uid();
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    const life = t.action ? 6500 : 4200;
    setTimeout(() => setToasts((prev) => prev.map((x) => x.id === id ? { ...x, leaving: true } : x)), life);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), life + 260);
  }, []);

  const mutate = useCallback((fn: (s: State) => State) => setState((prev) => (prev ? fn(prev) : prev)), []);

  const fetchAllTracks = useCallback(async (): Promise<Bundle[]> => {
    const out: Bundle[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 25; page++) {
      const url: string = `/api/tracks?limit=50&sort=new${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await api(url);
      if (!res.ok) break;
      out.push(...((res.items ?? []) as Bundle[]));
      cursor = res.nextCursor ?? null;
      if (!cursor) break;
    }
    return out;
  }, []);

  const refreshContent = useCallback(async () => {
    const bundles = await fetchAllTracks();
    if (!bundles.length) return;
    const boot = await api("/api/auth/bootstrap");
    mutate((st) => applyBundles(st, bundles, {
      liked: boot.liked ?? [], saved: boot.saved ?? [], following: boot.following ?? []
    }, boot.user?.id ?? null));
  }, [fetchAllTracks, mutate]);

  const refreshAuth = useCallback(async () => {
    const res = await api("/api/auth/bootstrap");
    if (!res.ok) return;
    setMeta({ mode: res.mode, mail: res.mailMode, google: res.googleEnabled });
    const bundles = await fetchAllTracks();
    mutate((st) => {
      const next: State = {
        ...st,
        users: mergeUsers(((res.profiles ?? []) as ServerUser[]).map(toUser)),
        sessionUserId: res.user?.id ?? null,
        mail: (res.devInbox ?? []) as DevMail[]
      };
      return bundles.length
        ? applyBundles(next, bundles, { liked: res.liked ?? [], saved: res.saved ?? [], following: res.following ?? [] }, res.user?.id ?? null)
        : next;
    });
  }, [fetchAllTracks, mutate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let prefs: Prefs = { muted: false, volume: 0.85, repeatOne: false };
      let legacy: State | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) prefs = { ...prefs, ...(JSON.parse(raw).prefs ?? {}) };
        for (const k of LEGACY_KEYS) {
          const old = localStorage.getItem(k);
          if (old) { const parsed = JSON.parse(old) as State; if (parsed?.tracks?.length) { legacy = parsed; break; } }
        }
      } catch { /* ignore */ }

      const seeded = await buildSeed();
      if (!alive) return;
      setBootNote("Loading the catalog…");

      const boot = await api("/api/auth/bootstrap");
      if (!alive) return;
      if (!boot.ok) {
        setState({ ...seeded, prefs, users: mergeUsers([]), sessionUserId: null, mail: [] });
        push({ kind: "err", msg: boot.error ?? "Server unavailable. Browsing works; posting is disabled." });
        return;
      }
      setMeta({ mode: boot.mode, mail: boot.mailMode, google: boot.googleEnabled });
      const bundles = await fetchAllTracks();
      if (!alive) return;

      const base: State = {
        ...seeded, prefs,
        users: mergeUsers(((boot.profiles ?? []) as ServerUser[]).map(toUser)),
        sessionUserId: boot.user?.id ?? null,
        mail: (boot.devInbox ?? []) as DevMail[]
      };
      setState(bundles.length
        ? applyBundles(base, bundles, { liked: boot.liked ?? [], saved: boot.saved ?? [], following: boot.following ?? [] }, boot.user?.id ?? null)
        : base);

      // One-time offer to lift the old browser studio onto the server.
      const already = localStorage.getItem(MIGRATED_FLAG);
      const own = legacy?.tracks.filter((t) => t.userId === legacy?.sessionUserId || t.userId === "u-aria") ?? [];
      if (boot.user && !already && own.length > 0) {
        push({
          kind: "info",
          msg: `Found ${own.length} track${own.length === 1 ? "" : "s"} in your old browser studio.`,
          action: {
            label: "Move to server",
            fn: () => {
              void (async () => {
                setSyncing(true);
                const payload: any[] = [];
                for (const t of own) {
                  let audioPath: string | undefined;
                  let coverPath: string | undefined;
                  if (t.audioKey && !t.preset) {
                    const up = await uploadLocalBlob("audio", t.audioKey);
                    audioPath = up?.path;
                  }
                  if (t.thumbKey) {
                    const up = await uploadLocalBlob("cover", t.thumbKey);
                    coverPath = up?.path;
                  }
                  if (t.source === "upload" && !t.preset && !audioPath) continue;
                  payload.push({
                    localId: t.id, title: t.title, source: t.source, youtubeId: t.youtubeId,
                    live: t.live, preset: t.preset, audioPath, coverPath,
                    coverSeed: t.coverSeed, coverPalette: t.coverPalette,
                    background: t.background, stylePrompt: t.stylePrompt, lyrics: t.lyrics,
                    instrumental: t.instrumental, duration: t.duration,
                    rightsAttested: true, createdAt: t.createdAt
                  });
                }
                const comments = (legacy?.comments ?? [])
                  .filter((c) => payload.some((p) => p.localId === c.trackId))
                  .map((c) => ({ trackLocalId: c.trackId, text: c.text, createdAt: c.createdAt }));
                const res = await api("/api/studio/import", { method: "POST", body: JSON.stringify({ tracks: payload, comments }) });
                setSyncing(false);
                localStorage.setItem(MIGRATED_FLAG, "1");
                if (res.ok) {
                  push({ kind: "ok", msg: `${res.imported} track${res.imported === 1 ? "" : "s"} moved to your account.` });
                  await refreshContent();
                } else push({ kind: "err", msg: res.error ?? "Import failed." });
              })();
            }
          }
        });
      }
    })();
    return () => { alive = false; };
  }, [fetchAllTracks, push, refreshContent]);

  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(KEY, JSON.stringify({ prefs: state.prefs })); } catch { /* quota */ }
  }, [state]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refreshAuth(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshAuth]);

  if (!state) return <StoreContext.Provider value={null as any}><BootSplash note={bootNote} /></StoreContext.Provider>;

  const s = state;
  const currentUser = s.users.find((u) => u.id === s.sessionUserId) ?? null;

  const rollback = (msg: string) => { push({ kind: "err", msg }); void refreshContent(); };

const publishToServer = async (localId: string, input: TrackInput, mode: "create" | "update") => {
  setSyncing(true);
  let audioPath: string | undefined;
  let audioMime: string | undefined;
  let audioBytes: number | undefined;
  let coverPath: string | undefined;

  if (input.source === "upload") {
    if (input.audioKey) {
      const up = await uploadLocalBlob("audio", input.audioKey, (percent) => {
        console.log(`Upload progress: ${percent}%`);
      });
      if (!up) {
        setSyncing(false);
        rollback("Couldn't upload the audio file.");
        return;
      }
      audioPath = up.path;
      audioMime = up.mime;
      audioBytes = up.bytes;
    } else if (input.audioKey?.startsWith("/api/media/")) {
      audioPath = decodeURIComponent(input.audioKey.split("/").pop() ?? "");
    }
    
    if (input.thumbKey) {
      const up = await uploadLocalBlob("cover", input.thumbKey);
      coverPath = up?.path;
    }
    
    if (!input.preset && !audioPath) {
      setSyncing(false);
      rollback("No audio was attached.");
      return;
    }
  }

    const body = {
      title: input.title, source: input.source, youtubeId: input.youtubeId, live: input.live,
      preset: input.preset, audioPath, audioMime, audioBytes, coverPath,
      coverSeed: input.coverSeed, coverPalette: input.coverPalette,
      background: input.background, stylePrompt: input.stylePrompt,
      lyrics: input.instrumental ? "" : input.lyrics, instrumental: input.instrumental,
      duration: input.duration, rightsAttested: true
    };

    const res = mode === "create"
      ? await api("/api/tracks", { method: "POST", body: JSON.stringify(body) })
      : await api(`/api/tracks/${encodeURIComponent(localId)}`, { method: "PATCH", body: JSON.stringify(body) });
    setSyncing(false);

    if (!res.ok) { rollback(res.error ?? "Couldn't save the track to the server."); return; }
    const server: Track = res.track;
    mutate((st) => ({
      ...st,
      tracks: st.tracks.some((t) => t.id === server.id)
        ? st.tracks.map((t) => (t.id === server.id || t.id === localId ? server : t))
        : [server, ...st.tracks.filter((t) => t.id !== localId)],
      comments: st.comments.map((c) => c.trackId === localId ? { ...c, trackId: server.id } : c),
      likes: st.likes.map((l) => l.trackId === localId ? { ...l, trackId: server.id } : l),
      saves: st.saves.map((l) => l.trackId === localId ? { ...l, trackId: server.id } : l)
    }));
    push({ kind: "ok", msg: mode === "create" ? "Published to the server — visible on every device." : "Track updated." });
  };

  const ctx: StoreCtx = {
    state: s, currentUser,
    serverMode: meta.mode, mailMode: meta.mail, googleEnabled: meta.google, syncing,

    async signup(name, email, pass) {
      const res = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password: pass }) });
      await refreshAuth();
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Signup failed.", code: res.code };
    },
    async login(email, pass) {
      const res = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: pass }) });
      if (!res.ok) return { ok: false, error: res.error ?? "Login failed.", code: res.code };
      await refreshAuth();
      return { ok: true };
    },
    demoLogin() {
      const demo = s.users.find((u) => u.email === "aria@gmail.com" || (u.provider === "demo" && u.handle === "ariavale"));
      const previous = s.sessionUserId;
      if (demo) mutate((st) => ({ ...st, sessionUserId: demo.id }));
      void (async () => {
        const res = await api("/api/auth/demo", { method: "POST", body: "{}" });
        if (!res.ok) { mutate((st) => ({ ...st, sessionUserId: previous })); push({ kind: "err", msg: res.error ?? "Demo login failed." }); return; }
        await refreshAuth();
      })();
    },
    logout() {
      mutate((st) => ({ ...st, sessionUserId: null, likes: [], saves: [], follows: [] }));
      void api("/api/auth/logout", { method: "POST", body: "{}" }).then(() => refreshAuth());
    },
    async verifyToken(token) {
      const res = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) });
      await refreshAuth();
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Verification failed.", code: res.code };
    },
    async resendVerification(email) {
      const res = await api("/api/auth/resend", { method: "POST", body: JSON.stringify({ email }) });
      await refreshAuth();
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Could not resend.", code: res.code };
    },
    refreshAuth, refreshContent,

    addTrack(input) {
      const u = currentUser;
      const id = uid();
      if (!u) return id;
      const track: Track = { id, userId: u.id, ...input, plays: 0, baseLikes: 0, createdAt: Date.now() };
      mutate((st) => ({ ...st, tracks: [track, ...st.tracks] }));
      void publishToServer(id, input, "create");
      return id;
    },

    updateTrack(id, input) {
      mutate((st) => ({ ...st, tracks: st.tracks.map((t) => t.id === id ? { ...t, ...input, updatedAt: Date.now() } : t) }));
      void publishToServer(id, input, "update");
    },

    deleteTrack(id) {
      const cur = stateRef.current!;
      const track = cur.tracks.find((t) => t.id === id);
      if (!track) return null;
      const comments = cur.comments.filter((c) => c.trackId === id);
      const likes = cur.likes.filter((l) => l.trackId === id);
      const saves = cur.saves.filter((x) => x.trackId === id);
      const restore = () => mutate((st) => ({
        ...st,
        tracks: [track, ...st.tracks.filter((t) => t.id !== id)].sort((a, b) => b.createdAt - a.createdAt),
        comments: [...st.comments.filter((c) => c.trackId !== id), ...comments],
        likes: [...st.likes.filter((l) => l.trackId !== id), ...likes],
        saves: [...st.saves.filter((x) => x.trackId !== id), ...saves]
      }));
      mutate((st) => ({
        ...st,
        tracks: st.tracks.filter((t) => t.id !== id),
        comments: st.comments.filter((c) => c.trackId !== id),
        likes: st.likes.filter((l) => l.trackId !== id),
        saves: st.saves.filter((x) => x.trackId !== id)
      }));
      void api(`/api/tracks/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => {
        if (!res.ok) rollback(res.error ?? "Couldn't delete on the server.");
      });
      return () => {
        restore();
        void api(`/api/tracks/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" }).then((res) => {
          if (!res.ok) rollback(res.error ?? "Couldn't restore on the server.");
        });
      };
    },

    toggleLike(trackId) {
      const u = currentUser; if (!u) return;
      const was = s.likes.some((l) => l.userId === u.id && l.trackId === trackId);
      mutate((st) => ({
        ...st,
        likes: was ? st.likes.filter((l) => !(l.userId === u.id && l.trackId === trackId)) : [...st.likes, { userId: u.id, trackId, createdAt: Date.now() }]
      }));
      void api(`/api/tracks/${encodeURIComponent(trackId)}/like`, { method: "POST", body: JSON.stringify({ on: !was }) }).then((res) => {
        if (!res.ok) { rollback(res.error ?? "Couldn't save your like."); return; }
        mutate((st) => ({ ...st, tracks: st.tracks.map((t) => t.id === trackId ? { ...t, baseLikes: Math.max(0, Number(res.likeCount ?? t.baseLikes) - (!was ? 1 : 0)) } : t) }));
      });
    },

    toggleSave(trackId) {
      const u = currentUser; if (!u) return;
      const was = s.saves.some((l) => l.userId === u.id && l.trackId === trackId);
      mutate((st) => ({
        ...st,
        saves: was ? st.saves.filter((l) => !(l.userId === u.id && l.trackId === trackId)) : [...st.saves, { userId: u.id, trackId, createdAt: Date.now() }]
      }));
      
      // Fire-and-forget to server for standard save
      void api(`/api/tracks/${encodeURIComponent(trackId)}/save`, { method: "POST", body: JSON.stringify({ on: !was }) }).then((res) => {
        if (!res.ok) rollback(res.error ?? "Couldn't save that.");
      });

      // Also update the "Saved Tracks" playlist
      void api("/api/playlists/saved/tracks", {
        method: "POST",
        body: JSON.stringify({ trackId, action: was ? "remove" : "add" })
      }).catch(() => undefined);
    },

    toggleFollow(targetId) {
      const u = currentUser; if (!u || u.id === targetId) return;
      const was = s.follows.some((f) => f.followerId === u.id && f.targetId === targetId);
      mutate((st) => ({
        ...st,
        follows: was ? st.follows.filter((f) => !(f.followerId === u.id && f.targetId === targetId)) : [...st.follows, { followerId: u.id, targetId }]
      }));
      void api(`/api/profiles/${encodeURIComponent(targetId)}/follow`, { method: "POST", body: JSON.stringify({ on: !was }) }).then((res) => {
        if (!res.ok) rollback(res.error ?? "Couldn't update follow.");
      });
    },

    addComment(trackId, text) {
      const u = currentUser; if (!u) return;
      const tempId = uid();
      const optimistic: Comment = { id: tempId, trackId, userId: u.id, text: text.trim(), createdAt: Date.now() };
      mutate((st) => ({ ...st, comments: [...st.comments, optimistic] }));
      void api(`/api/tracks/${encodeURIComponent(trackId)}/comments`, { method: "POST", body: JSON.stringify({ text }) }).then((res) => {
        if (!res.ok) {
          mutate((st) => ({ ...st, comments: st.comments.filter((c) => c.id !== tempId) }));
          push({ kind: "err", msg: res.error ?? "Couldn't post the comment." });
          return;
        }
        mutate((st) => ({ ...st, comments: st.comments.map((c) => c.id === tempId ? res.comment : c) }));
      });
    },

    deleteComment(id) {
      const cur = stateRef.current!;
      const c = cur.comments.find((x) => x.id === id);
      if (!c) return null;
      mutate((st) => ({ ...st, comments: st.comments.filter((x) => x.id !== id) }));
      void api(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => {
        if (!res.ok) rollback(res.error ?? "Couldn't delete the comment.");
      });
      return () => {
        mutate((st) => ({ ...st, comments: [...st.comments, c].sort((a, b) => a.createdAt - b.createdAt) }));
        void api(`/api/tracks/${encodeURIComponent(c.trackId)}/comments`, { method: "POST", body: JSON.stringify({ text: c.text }) }).then(() => refreshContent());
      };
    },

    incPlay(trackId) {
      const now = Date.now();
      const last = playThrottle.current.get(trackId) ?? 0;
      mutate((st) => ({ ...st, tracks: st.tracks.map((t) => t.id === trackId ? { ...t, plays: t.plays + 1 } : t) }));
      if (now - last < 20_000) return;
      playThrottle.current.set(trackId, now);
      void api(`/api/tracks/${encodeURIComponent(trackId)}/play`, { method: "POST", body: "{}" });
    },

    updateProfile(patch) {
      const u = currentUser; if (!u) return;
      const before = u;
      mutate((st) => ({ ...st, users: st.users.map((x) => x.id === u.id ? { ...x, ...patch } : x) }));
      void (async () => {
        const res = await api("/api/profile", { method: "PATCH", body: JSON.stringify(patch) });
        if (!res.ok) {
          mutate((st) => ({ ...st, users: st.users.map((x) => x.id === before.id ? before : x) }));
          push({ kind: "err", msg: res.error ?? "Profile update failed." });
          return;
        }
        await refreshAuth();
      })();
    },

    setPrefs(patch) { mutate((st) => ({ ...st, prefs: { ...st.prefs, ...patch } })); },

    notificationCount,
    refreshNotifications,

    likeCount: (t) => {
      const base = Math.max(0, Number(t.baseLikes ?? 0) || 0);
      const mine = currentUser
        ? s.likes.filter((l) => l.trackId === t.id && l.userId === currentUser.id).length
        : 0;
      return base + mine;
    },
    isLiked: (trackId) => !!currentUser && s.likes.some((l) => l.userId === currentUser.id && l.trackId === trackId),
    isSaved: (trackId) => !!currentUser && s.saves.some((l) => l.userId === currentUser.id && l.trackId === trackId),
    isFollowing: (targetId) => !!currentUser && s.follows.some((f) => f.followerId === currentUser.id && f.targetId === targetId),
    userById: (id) => s.users.find((u) => u.id === id),
    commentsFor: (trackId) => s.comments.filter((c) => c.trackId === trackId).sort((a, b) => a.createdAt - b.createdAt)
  };

  return (
    <StoreContext.Provider value={ctx}>
      <ToastContext.Provider value={{ push }}>
        {children}
        {syncing && <div className="sync-pill" role="status"><span className="eq eq-sm on"><i /><i /><i /><i /><i /></span>Syncing to server…</div>}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}${t.leaving ? " leaving" : ""}`}>
              <span className="toast-dot" />
              <span className="toast-msg">{t.msg}</span>
              {t.action && (
                <button className="toast-act" onClick={() => { t.action!.fn(); setToasts((prev) => prev.filter((x) => x.id !== t.id)); }}>
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </StoreContext.Provider>
  );
}