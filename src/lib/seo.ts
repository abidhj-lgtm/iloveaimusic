import type { Metadata } from "next";
import type { Track, User } from "./types";
import { isoDuration, likeTotal, trackTags } from "./catalog";
import { coverUrl } from "./covers";
import { ytThumb, ytWatch, ytEmbed } from "./youtube";

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const SITE = {
  name: "I Love AI Music",
  shortName: "I Love AI",
  legalName: "I Love AI Music",
  domain: "iloveaimusic.com",
  url: resolveSiteUrl(),
  tagline: "Where AI music finds its listeners.",
  description:
    "A community feed for AI-generated music. Post a track from your computer or embed it from YouTube, publish the exact style prompt, the story behind it, and the lyrics — then listen in a chronological feed with a persistent player.",
  locale: "en_US",
  twitter: "@iloveaimusic",
  handle: "iloveaimusic",
  email: "hello@iloveaimusic.com",
  legalEmail: "legal@iloveaimusic.com",
  moderationEmail: "moderation@iloveaimusic.com",
  foundingYear: 2026,
  keywords: [
    "AI music", "AI generated music", "AI music community", "AI music feed",
    "share AI songs", "AI music prompts", "Suno prompts", "Udio prompts",
    "AI song lyrics", "prompt to music", "AI synthwave", "AI lo-fi",
    "AI ambient", "upload AI music", "AI music discovery", "music prompt sharing",
    "I Love AI Music", "iloveaimusic"
  ]
};

export const absoluteUrl = (path = "/") => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;

export const trackCover = (t: Track): string =>
  t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : coverUrl(t.coverSeed, t.coverPalette);

export function ogImageUrl(opts: { title: string; subtitle?: string; palette?: number; kind?: string }): string {
  const p = new URLSearchParams({ title: opts.title.slice(0, 90) });
  if (opts.subtitle) p.set("subtitle", opts.subtitle.slice(0, 60));
  if (opts.palette !== undefined) p.set("palette", String(opts.palette));
  if (opts.kind) p.set("kind", opts.kind);
  return absoluteUrl(`/api/og?${p.toString()}`);
}

export function trackDescription(t: Track, artist: User): string {
  const base = t.background.replace(/\s+/g, " ").trim();
  const lead = `${t.title} by ${artist.name} — ${t.instrumental ? "an instrumental" : "a vocal"} AI music track`;
  const style = t.stylePrompt ? ` Style prompt: ${t.stylePrompt}.` : "";
  const body = base.length > 150 ? `${base.slice(0, 147)}…` : base;
  return `${lead}. ${body}${style}`.slice(0, 300);
}

export function pageMetadata(opts: {
  title: string; description: string; path: string; image?: string;
  keywords?: string[]; type?: "website" | "article" | "profile" | "music.song";
  publishedTime?: number; modifiedTime?: number; noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  const image = opts.image ?? ogImageUrl({ title: opts.title, subtitle: SITE.tagline });
  const og: Record<string, unknown> = {
    type: opts.type ?? "website",
    url, siteName: SITE.name, locale: SITE.locale,
    title: opts.title, description: opts.description,
    images: [{ url: image, width: 1200, height: 630, alt: opts.title }]
  };
  if (opts.type === "article") {
    if (opts.publishedTime) og.publishedTime = new Date(opts.publishedTime).toISOString();
    if (opts.modifiedTime) og.modifiedTime = new Date(opts.modifiedTime).toISOString();
  }
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords ?? SITE.keywords,
    alternates: { canonical: url },
    openGraph: og as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image", site: SITE.twitter, creator: SITE.twitter,
      title: opts.title, description: opts.description, images: [image]
    },
    robots: opts.noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org", "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name, alternateName: ["I Love AI", "iloveaimusic", "I Listen AI Music"],
    url: SITE.url, description: SITE.description, inLanguage: "en",
    publisher: { "@id": `${SITE.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/discover?q={search_term_string}` },
      "query-input": "required name=search_term_string"
    }
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org", "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name, url: SITE.url,
    logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg"), width: 512, height: 512 },
    description: SITE.description, email: SITE.email,
    foundingDate: String(SITE.foundingYear),
    sameAs: [`https://twitter.com/${SITE.handle}`, `https://instagram.com/${SITE.handle}`]
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) }))
  };
}

export function musicRecordingJsonLd(t: Track, artist: User) {
  const url = absoluteUrl(`/track/${t.id}`);
  const tags = trackTags(t);
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "MusicRecording",
    "@id": `${url}#recording`, name: t.title, url,
    description: trackDescription(t, artist), image: trackCover(t),
    datePublished: new Date(t.createdAt).toISOString(),
    ...(t.updatedAt ? { dateModified: new Date(t.updatedAt).toISOString() } : {}),
    ...(isoDuration(t.duration) ? { duration: isoDuration(t.duration) } : {}),
    ...(tags.length ? { genre: tags.slice(0, 4), keywords: tags.join(", ") } : {}),
    byArtist: {
      "@type": "MusicGroup", "@id": absoluteUrl(`/profile/${artist.handle}#artist`),
      name: artist.name, url: absoluteUrl(`/profile/${artist.handle}`)
    },
    inAlbum: { "@type": "MusicAlbum", name: `${artist.name} on ${SITE.name}`, byArtist: { "@type": "MusicGroup", name: artist.name } },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ListenAction", userInteractionCount: t.plays },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: likeTotal(t) }
    ],
    isAccessibleForFree: true
  };
  if (!t.instrumental && t.lyrics.trim()) {
    graph.recordingOf = {
      "@type": "MusicComposition", name: t.title,
      composer: { "@type": "Person", name: artist.name },
      lyrics: { "@type": "CreativeWork", text: t.lyrics.replace(/\[[^\]]+\]/g, "").trim() },
      inLanguage: "en"
    };
  }
  if (t.source === "youtube" && t.youtubeId) {
    graph.subjectOf = {
      "@type": "VideoObject", name: t.title, description: trackDescription(t, artist),
      thumbnailUrl: ytThumb(t.youtubeId), uploadDate: new Date(t.createdAt).toISOString(),
      embedUrl: ytEmbed(t.youtubeId), contentUrl: ytWatch(t.youtubeId),
      ...(t.live ? { publication: { "@type": "BroadcastEvent", isLiveBroadcast: true } } : {})
    };
  }
  return graph;
}

export function profilePageJsonLd(artist: User, tracks: Track[]) {
  const url = absoluteUrl(`/profile/${artist.handle}`);
  return {
    "@context": "https://schema.org", "@type": "ProfilePage",
    "@id": `${url}#profile`, url,
    name: `${artist.name} — AI music artist`,
    description: artist.bio || `${artist.name} publishes AI-generated music on ${SITE.name}.`,
    dateCreated: new Date(artist.createdAt).toISOString(),
    mainEntity: {
      "@type": "MusicGroup", "@id": `${url}#artist`,
      name: artist.name, alternateName: `@${artist.handle}`, url,
      description: artist.bio || undefined,
      genre: [...new Set(tracks.flatMap(trackTags))].slice(0, 6),
      track: tracks.map((t) => ({
        "@type": "MusicRecording", name: t.title, url: absoluteUrl(`/track/${t.id}`),
        ...(isoDuration(t.duration) ? { duration: isoDuration(t.duration) } : {})
      }))
    }
  };
}

export function itemListJsonLd(tracks: Track[], name: string, path: string) {
  return {
    "@context": "https://schema.org", "@type": "ItemList",
    name, url: absoluteUrl(path), numberOfItems: tracks.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: tracks.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/track/${t.id}`), name: t.title }))
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } }))
  };
}

export const jsonLdScript = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });