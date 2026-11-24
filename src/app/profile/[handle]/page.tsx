import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Music2, User as UserIcon } from "lucide-react";
import { pageMetadata, ogImageUrl, profilePageJsonLd, breadcrumbJsonLd, jsonLdScript, SITE } from "@/lib/seo";
import { avatarUrl, PALETTES, coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { formatCount, formatDuration } from "@/lib/utils";
import { absoluteDate } from "@/lib/catalog";
import { ProfileActions, ProfileGrid, ProfileCollections, ProfileLiveStats } from "@/components/profile-island";
import { PlayButton } from "@/components/play-button";
import { EmptyState } from "@/components/track-card";
import { artistCatalog } from "@/server/content-service";
import type { Track, User } from "@/lib/types";

export const dynamicParams = true;
export const revalidate = 120;

async function load(handle: string) {
  const data = await artistCatalog(handle).catch(() => null);
  if (!data) return null;
  const { profile, rows } = data;
  const artist: User = {
    id: profile.legacy_id ?? profile.id, name: profile.name, handle: profile.handle, email: "",
    verified: profile.verified, provider: profile.provider, bio: profile.bio,
    avatarPalette: profile.avatar_palette, createdAt: Date.parse(profile.created_at)
  };
  const tracks: Track[] = rows.map((r) => ({
    id: r.legacy_id ?? r.id, userId: artist.id, title: r.title, source: r.source,
    youtubeId: r.youtube_id ?? undefined, live: r.is_live || undefined, preset: r.preset ?? undefined,
    coverSeed: r.cover_seed, coverPalette: r.cover_palette, background: r.background,
    stylePrompt: r.style_prompt, lyrics: r.lyrics, instrumental: r.instrumental,
    duration: r.duration ?? undefined, plays: r.plays, baseLikes: r.like_count,
    createdAt: Date.parse(r.created_at)
  }));
  return { artist, tracks };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) return pageMetadata({ title: "Artist", description: `AI music artists on ${SITE.name}.`, path: `/profile/${handle}`, noindex: true });
  const { artist, tracks } = data;
  const genres = [...new Set(tracks.flatMap((t) => t.stylePrompt.split(",").map((s) => s.trim().toLowerCase())))].slice(0, 5);
  return pageMetadata({
    title: `${artist.name} (@${artist.handle}) — AI music artist`,
    description: `${artist.bio || `${artist.name} publishes AI-generated music on ${SITE.name}.`} ${tracks.length} track${tracks.length === 1 ? "" : "s"} with published prompts, stories and lyrics.`.slice(0, 300),
    path: `/profile/${artist.handle}`,
    image: ogImageUrl({ title: artist.name, subtitle: `@${artist.handle} · ${tracks.length} tracks`, palette: artist.avatarPalette, kind: "artist" }),
    keywords: [artist.name, `@${artist.handle}`, ...genres, "AI music artist"],
    type: "profile", noindex: tracks.length === 0
  });
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await load(handle);

  if (!data) {
    return (
      <div className="profile-page">
        <EmptyState icon={<UserIcon size={30} />} title="No artist at this address"
          body="This handle doesn't exist in the catalog. The feed is full of people who do."
          action={<Link href="/discover" className="btn btn-brand">Browse the catalog</Link>} />
      </div>
    );
  }

  const { artist, tracks } = data;
  const p = PALETTES[artist.avatarPalette % PALETTES.length];
  const genres = [...new Set(tracks.flatMap((t) => t.stylePrompt.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)))].slice(0, 8);
  const totalPlays = tracks.reduce((a, t) => a + t.plays, 0);
  const totalLikes = tracks.reduce((a, t) => a + t.baseLikes, 0);
  const queue = tracks.map((t) => t.id);
  const crumbs = [{ name: "Home", path: "/" }, { name: "Discover", path: "/discover" }, { name: artist.name, path: `/profile/${artist.handle}` }];

  return (
    <div className="profile-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(profilePageJsonLd(artist, tracks))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <nav className="seo-crumbs" aria-label="Breadcrumb">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Feed</Link>
        <span aria-hidden>/</span><Link href="/discover">Discover</Link>
        <span aria-hidden>/</span><span aria-current="page">{artist.name}</span>
      </nav>

      <div className="prof-banner" style={{ background: `linear-gradient(120deg, ${p.a}33, ${p.b}44 55%, ${p.c}22)` }} />
      <header className="prof-head fade-up">
        <span className="avatar-ring" style={{ width: 104, height: 104 }}>
          <img className="avatar-img" src={avatarUrl(artist.name, artist.avatarPalette)} alt={artist.name} width={96} height={96} />
        </span>
        <div className="prof-info">
          <h1 className="prof-name">{artist.name}</h1>
          <span className="prof-handle">@{artist.handle}{artist.provider === "demo" && <em className="demo-tag">demo artist</em>}</span>
          {artist.bio && <p className="prof-bio">{artist.bio}</p>}
          <div className="prof-stats">
            <span><strong>{tracks.length}</strong><em>tracks</em></span>
            <span><strong>{formatCount(totalLikes)}</strong><em>likes</em></span>
            <span><strong>{formatCount(totalPlays)}</strong><em>plays</em></span>
          </div>
          <ProfileLiveStats handle={artist.handle} />
          {genres.length > 0 && (
            <div className="seo-tagrow">{genres.map((g) => <Link key={g} className="chip" href={`/discover?tag=${encodeURIComponent(g)}`}>{g}</Link>)}</div>
          )}
        </div>
        <ProfileActions handle={artist.handle} />
      </header>

      <section className="section seo-section" id="discography">
        <h2 className="section-title"><Music2 size={18} />Discography · {tracks.length} tracks</h2>
        {tracks.length === 0 ? (
          <p className="prose">No published tracks yet.</p>
        ) : (
          <ul className="seo-tracklist">
            {tracks.map((t) => (
              <li key={t.id}>
                <PlayButton trackId={t.id} queue={queue} size="sm" />
                <img className="seo-tracklist-cover" src={t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : coverUrl(t.coverSeed, t.coverPalette)} alt="" loading="lazy" />
                <div>
                  <Link href={`/track/${t.id}`} className="seo-tracklist-title">{t.title}</Link>
                  <p>{t.background.slice(0, 150)}{t.background.length > 150 ? "…" : ""}</p>
                  <span className="seo-tracklist-prompt">{t.stylePrompt}</span>
                </div>
                <span className="seo-tracklist-meta">
                  <time dateTime={new Date(t.createdAt).toISOString()}>{absoluteDate(t.createdAt)}</time>
                  {t.duration ? ` · ${formatDuration(t.duration)}` : ""} · {formatCount(t.plays)} plays
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileGrid handle={artist.handle} />
      <ProfileCollections handle={artist.handle} />

      <section className="seo-context">
        <h2>About {artist.name}</h2>
        <p>
          {artist.bio || `${artist.name} is a member of ${SITE.name}.`}{" "}
          {tracks.length > 0
            ? `They have published ${tracks.length} track${tracks.length === 1 ? "" : "s"} covering ${genres.slice(0, 4).join(", ") || "AI-generated music"}, with ${formatCount(totalPlays)} plays and ${formatCount(totalLikes)} likes. Every track page includes the full style prompt, the session story, and the lyrics where the track has words.`
            : "Their studio is ready — the first upload will appear here and at the top of the feed."}
        </p>
        <p><Link href="/discover">Browse the catalog</Link> · <Link href="/faq">How AI music sharing works</Link> · <Link href="/create">Post your own music</Link></p>
      </section>
    </div>
  );
}