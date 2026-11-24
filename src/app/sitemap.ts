import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { publicCatalog } from "@/server/content-service";
import { coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/discover"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/legal/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/legal/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/legal/dmca"), lastModified: now, changeFrequency: "yearly", priority: 0.4 }
  ];

  try {
    const { entries } = await publicCatalog(5000);
    const tracks: MetadataRoute.Sitemap = entries.map((t) => ({
      url: absoluteUrl(`/track/${t.id}`),
      lastModified: new Date(t.updatedAt),
      changeFrequency: "weekly",
      priority: 0.8,
      images: [t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : coverUrl(t.coverSeed, t.coverPalette)]
    }));

    const artists = new Map<string, { handle: string; latest: number }>();
    for (const t of entries) {
      const cur = artists.get(t.userId);
      if (!cur || t.createdAt > cur.latest) artists.set(t.userId, { handle: t.artistHandle, latest: t.createdAt });
    }
    const profiles: MetadataRoute.Sitemap = [...artists.values()].map((a) => ({
      url: absoluteUrl(`/profile/${a.handle}`), lastModified: new Date(a.latest),
      changeFrequency: "weekly", priority: 0.7
    }));

    const tags = new Map<string, number>();
    for (const t of entries) {
      for (const raw of t.stylePrompt.split(",")) {
        const tag = raw.trim().toLowerCase();
        if (tag && tag.length < 26) tags.set(tag, (tags.get(tag) ?? 0) + 1);
      }
    }
    const tagPages: MetadataRoute.Sitemap = [...tags.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 60)
      .map(([tag]) => ({
        url: absoluteUrl(`/discover?tag=${encodeURIComponent(tag)}`),
        lastModified: now, changeFrequency: "weekly", priority: 0.5
      }));

    return [...staticPages, ...tracks, ...profiles, ...tagPages];
  } catch {
    return staticPages;
  }
}