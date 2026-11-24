import type { Metadata } from "next";
import Link from "next/link";
import { Search, Music2, Wand2, Headphones, TrendingUp, Users } from "lucide-react";
import { pageMetadata, ogImageUrl, itemListJsonLd, breadcrumbJsonLd, jsonLdScript, SITE } from "@/lib/seo";
import { avatarUrl, coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { formatCount, formatDuration } from "@/lib/utils";
import { absoluteDate } from "@/lib/catalog";
import { PlayButton } from "@/components/play-button";
import { publicCatalog, loadFeed } from "@/server/content-service";
import type { Track } from "@/lib/types";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tag?: string; q?: string }> }): Promise<Metadata> {
  const { tag, q } = await searchParams;
  const label = tag ? `${tag} AI music` : q ? `Search: ${q}` : "Discover AI music — the full catalog";
  const desc = tag
    ? `Every ${tag} track in the ${SITE.name} catalog, with the exact style prompts, the stories behind them, and the lyrics.`
    : `Browse every AI-generated track on ${SITE.name}: synthwave, lo-fi, ambient and vocal EDM, each published with its style prompt, background story, lyrics and provenance.`;
  return pageMetadata({
    title: label, description: desc.slice(0, 300),
    path: tag ? `/discover?tag=${encodeURIComponent(tag)}` : "/discover",
    image: ogImageUrl({ title: label, subtitle: "AI music catalog", palette: 5, kind: "catalog" }),
    keywords: tag ? [tag, `${tag} AI music`, `${tag} prompt`, "AI music catalog"] : SITE.keywords
  });
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ tag?: string; q?: string; sort?: string; page?: string }> }) {
  const sp = await searchParams;
  const activeTag = (sp.tag ?? "").trim().toLowerCase();
  const needle = (sp.q ?? "").trim();
  const sort = (["new", "old", "liked", "played"].includes(sp.sort ?? "") ? sp.sort : "new") as "new" | "old" | "liked" | "played";
  const query = needle || activeTag;

  const [{ entries, total }, feed] = await Promise.all([
    publicCatalog(2000).catch(() => ({ entries: [], total: 0 })),
    loadFeed({ viewerId: null, sort, view: "all", q: query, cursor: sp.page ?? null, limit: 24 }).catch(() => ({ items: [], nextCursor: null, hasMore: false }))
  ]);

  const tagCounts = new Map<string, number>();
  for (const t of entries) {
    for (const raw of t.stylePrompt.split(",")) {
      const tag = raw.trim().toLowerCase();
      if (tag && tag.length < 26) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18);

  const artistMap = new Map<string, { name: string; handle: string; bio: string; palette: number; tracks: number }>();
  for (const t of entries) {
    const cur = artistMap.get(t.userId) ?? { name: t.artistName, handle: t.artistHandle, bio: t.artistBio, palette: t.artistPalette, tracks: 0 };
    cur.tracks++; artistMap.set(t.userId, cur);
  }
  const artists = [...artistMap.entries()].sort((a, b) => b[1].tracks - a[1].tracks);
  const totalPlays = entries.reduce((a, t) => a + t.plays, 0);

  const rows = feed.items.map((i) => i.track);
  const queue = rows.map((t) => t.id);
  const ldTracks: Track[] = rows;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Discover", path: "/discover" }];
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (activeTag) p.set("tag", activeTag);
    if (needle) p.set("q", needle);
    if (sort !== "new") p.set("sort", sort);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    const s = p.toString();
    return s ? `/discover?${s}` : "/discover";
  };

  return (
    <div className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(itemListJsonLd(ldTracks, activeTag ? `${activeTag} AI tracks` : "AI music catalog", "/discover"))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <header className="seo-hero">
        <span className="seo-eyebrow"><Headphones size={15} />Public catalog · server-rendered · crawlable</span>
        <h1>Discover AI music, with the prompts attached.</h1>
        <p>Every track here was made with an AI model and published by its creator alongside the exact style prompt, the story of the session, and the lyrics. Read it, play it, copy the prompt, make your own.</p>
        <div className="seo-hero-stats">
          <span><Music2 size={15} /><strong>{total}</strong> tracks</span>
          <span><Users size={15} /><strong>{artists.length}</strong> artists</span>
          <span><TrendingUp size={15} /><strong>{formatCount(totalPlays)}</strong> plays</span>
        </div>
      </header>

      <form className="seo-search" action="/discover" method="get" role="search">
        <Search size={17} />
        <input name="q" defaultValue={needle} placeholder="Search titles, artists, prompts, lyrics…" aria-label="Search the catalog" />
        {activeTag && <input type="hidden" name="tag" value={activeTag} />}
        <button className="btn btn-brand btn-sm" type="submit">Search</button>
      </form>

      <nav className="seo-facets" aria-label="Filter by style">
        <Link className={`chip${!activeTag && !needle ? " active" : ""}`} href="/discover">All</Link>
        {tags.map(([tag, count]) => (
          <Link key={tag} className={`chip${activeTag === tag ? " active" : ""}`} href={href({ tag, q: undefined, page: undefined })}>{tag}<em>{count}</em></Link>
        ))}
      </nav>

      <div className="seo-resultline">
        <span>{rows.length} shown{activeTag ? ` tagged “${activeTag}”` : ""}{needle ? ` matching “${needle}”` : ""}</span>
        <div className="seo-sortlinks">
          {(["new", "old", "liked", "played"] as const).map((s) => (
            <Link key={s} className={`chip${sort === s ? " active" : ""}`} href={href({ sort: s === "new" ? undefined : s, page: undefined })}>
              {s === "new" ? "Newest" : s === "old" ? "Oldest" : s === "liked" ? "Most liked" : "Most played"}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="seo-empty">
          <h2>Nothing on this frequency.</h2>
          <p>No track matches that filter yet. Try a broader tag, or <Link href="/create">post the first one</Link>.</p>
        </div>
      ) : (
        <ol className="seo-catalog">
          {rows.map((t, i) => {
            const artist = artistMap.get(t.userId);
            const cover = t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : coverUrl(t.coverSeed, t.coverPalette);
            return (
              <li key={t.id} className="seo-catalog-item">
                <span className="seo-rank">{String(i + 1).padStart(2, "0")}</span>
                <Link href={`/track/${t.id}`} className="seo-catalog-cover"><img src={cover} alt={`Cover art for ${t.title}`} loading="lazy" /></Link>
                <div className="seo-catalog-body">
                  <h2><Link href={`/track/${t.id}`}>{t.title}</Link></h2>
                  <p className="seo-catalog-artist">
                    {artist && <img src={avatarUrl(artist.name, artist.palette)} alt="" width={22} height={22} />}
                    {artist ? <Link href={`/profile/${artist.handle}`}>{artist.name}</Link> : <span>Unknown artist</span>}
                    <span>· <time dateTime={new Date(t.createdAt).toISOString()}>{absoluteDate(t.createdAt)}</time></span>
                    <span className={`src-badge ${t.source === "youtube" ? "yt" : t.preset ? "gen" : "up"} sm`}>
                      {t.source === "youtube" ? (t.live ? "Live" : "YouTube") : t.preset ? "Synth" : "Upload"}
                    </span>
                  </p>
                  <p className="seo-catalog-bg">{t.background}</p>
                  <p className="seo-catalog-prompt"><Wand2 size={13} />{t.stylePrompt}</p>
                  <div className="seo-catalog-tags">
                    {t.stylePrompt.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 6).map((x) => (
                      <Link key={x} className="tag" href={href({ tag: x, q: undefined, page: undefined })}>{x}</Link>
                    ))}
                  </div>
                </div>
                <div className="seo-catalog-side">
                  <PlayButton trackId={t.id} queue={queue} />
                  <span>{formatCount(t.plays)} plays</span>
                  <span>{formatCount(t.baseLikes)} likes</span>
                  {t.duration && <span>{formatDuration(t.duration)}</span>}
                  <span>{t.instrumental ? "Instrumental" : "Vocal"}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {feed.hasMore && feed.nextCursor && (
        <div className="seo-pager">
          <Link className="btn btn-brand" href={href({ page: feed.nextCursor })}>Next 24 tracks</Link>
        </div>
      )}

      <section className="seo-section" id="artists">
        <h2 className="section-title"><Users size={18} />Artists in the catalog</h2>
        <div className="seo-artists">
          {artists.map(([id, a]) => (
            <Link key={id} href={`/profile/${a.handle}`} className="seo-artist-card">
              <img src={avatarUrl(a.name, a.palette)} alt={a.name} width={52} height={52} />
              <div><strong>{a.name}</strong><em>@{a.handle} · {a.tracks} track{a.tracks === 1 ? "" : "s"}</em><p>{a.bio}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="seo-context">
        <h2>What makes this catalog different</h2>
        <p>Most music sites hide the process. {SITE.name} publishes it: the <strong>background</strong>, the <strong>style prompt</strong> in a copyable block, the <strong>lyrics</strong> with section markers, the <strong>source</strong>, and a provenance record naming the AI tool and the creator&apos;s human contribution.</p>
        <p><Link href="/faq">Read the FAQ</Link> · <Link href="/legal/dmca">Copyright policy</Link> · <Link href="/create">Post your own music</Link></p>
      </section>
    </div>
  );
}