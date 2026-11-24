declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

export function parseYouTubeId(url: string): string | null {
  const s = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) { const m = s.match(p); if (m) return m[1]; }
  return null;
}

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const ytEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&enablejsapi=1&playsinline=1`;

let ytPromise: Promise<any> | null = null;
export function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ytPromise = null; reject(new Error("yt-timeout")); }, 12000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => { clearTimeout(timer); ytPromise = null; reject(new Error("yt-load")); };
    document.head.appendChild(tag);
  });
  return ytPromise;
}

export async function fetchOEmbed(url: string): Promise<{ title?: string; author?: string } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.error) return null;
    return { title: j.title, author: j.author_name };
  } catch { return null; }
}