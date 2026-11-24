import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wand2, BookOpen, Music2, Clock, Disc3, Headphones } from "lucide-react";
import { CATALOG_TRACKS, absoluteDate, trackTags, isoDuration } from "@/lib/catalog";
import { SITE, pageMetadata, trackDescription, ogImageUrl, musicRecordingJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { avatarUrl, coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { formatDuration, formatCount } from "@/lib/utils";
import { TrackActions, TrackCoverIsland, TrackEmbed, TrackComments, TrackRelated, TrackPromptCopy, TrackClientOnly } from "@/components/track-island";
import { TrackTrust } from "@/components/track-trust";
import { PlayButton } from "@/components/play-button";
import { getTrackBundle } from "@/server/content-service";
import { getRights } from "@/server/trust/service";
import { getRepo } from "@/server/store";
import type { Track, User } from "@/lib/types";

export const dynamicParams = true;
export const revalidate = 0;

export function generateStaticParams() {
  return CATALOG_TRACKS.map((t) => ({ id: t.id }));
}

async function load(publicId: string): Promise<{ track: Track; artist: User; likeCount: number } | null> {
  try {
    const bundle = await getTrackBundle(publicId, null);
    if (!bundle) return null;
    const repo = getRepo();
    const profiles = await repo.listProfiles();
    const owner = profiles.find((p) => (p.legacy_id ?? p.id) === bundle.track.userId);
    if (!owner) return null;
    const artist: User = {
      id: owner.legacy_id ?? owner.id, name: owner.name, handle: owner.handle, email: "",
      verified: owner.verified, provider: owner.provider, bio: owner.bio,
      avatarPalette: owner.avatar_palette, createdAt: Date.parse(owner.created_at)
    };
    return { track: bundle.track, artist, likeCount: bundle.track.baseLikes };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return pageMetadata({ title: "Track", description: `Listen to AI-generated music on ${SITE.name}.`, path: `/track/${id}`, noindex: true });
  const { track, artist } = data;
  return pageMetadata({
    title: `${track.title} — ${artist.name}`,
    description: trackDescription(track, artist),
    path: `/track/${track.id}`,
    image: ogImageUrl({ title: track.title, subtitle: artist.name, palette: track.coverPalette, kind: track.source === "youtube" ? "youtube" : "track" }),
    keywords: [...trackTags(track), artist.name, "AI music", `${artist.name} AI songs`],
    type: "music.song", publishedTime: track.createdAt, modifiedTime: track.updatedAt
  });
}

function LyricBlocks({ lyrics }: { lyrics: string }) {
  return (
    <div className="lyrics">
      {lyrics.replace(/\r/g, "").split(/\n{2,}/).map((block, bi) => (
        <div className="stanza" key={bi}>
          {block.split("\n").map((line, li) => {
            const m = line.trim().match(/^\[(.+)\]$/);
            if (m) return <span className="sec-marker" key={li}>{m[1]}</span>;
            return <span className="lyric-line" key={li}>{line || "\u00A0"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) return <TrackClientOnly trackId={id} />;

  const { track, artist, likeCount } = data;
  const rights = await getRights(track.id).catch(() => null);
  const tags = trackTags(track);
  const cover = track.source === "youtube" && track.youtubeId ? ytThumb(track.youtubeId) : coverUrl(track.coverSeed, track.coverPalette);

  let related: Track[] = [];
  try {
    const repo = getRepo();
    const profiles = await repo.listProfiles();
    const ownerRow = profiles.find((p) => (p.legacy_id ?? p.id) === artist.id);
    if (ownerRow) {
      const rows = await repo.tracksByUser(ownerRow.id);
      related = rows.filter((r) => (r.legacy_id ?? r.id) !== track.id).slice(0, 6).map((r) => ({
        id: r.legacy_id ?? r.id, userId: artist.id, title: r.title, source: r.source,
        youtubeId: r.youtube_id ?? undefined, coverSeed: r.cover_seed, coverPalette: r.cover_palette,
        background: r.background, stylePrompt: r.style_prompt, lyrics: r.lyrics,
        instrumental: r.instrumental, duration: r.duration ?? undefined,
        plays: r.plays, baseLikes: r.like_count, createdAt: Date.parse(r.created_at)
      }));
    }
  } catch { /* keep empty */ }

  const crumbs = [
    { name: "Home", path: "/" }, { name: "Discover", path: "/discover" },
    { name: artist.name, path: `/profile/${artist.handle}` }, { name: track.title, path: `/track/${track.id}` }
  ];

  void cover;

  return (
    <div className="detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(musicRecordingJsonLd(track, artist))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <nav className="seo-crumbs" aria-label="Breadcrumb">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Feed</Link>
        <span aria-hidden>/</span><Link href="/discover">Discover</Link>
        <span aria-hidden>/</span><Link href={`/profile/${artist.handle}`}>{artist.name}</Link>
        <span aria-hidden>/</span><span aria-current="page">{track.title}</span>
      </nav>

      <article className="track-hero fade-up">
        <TrackCoverIsland trackId={track.id} />
        <div className="hero-info">
          <div className="hero-badges">
            <span className={`src-badge ${track.source === "youtube" ? "yt" : track.preset ? "gen" : "up"}`}>
              {track.source === "youtube" ? (track.live ? "YouTube · Live" : "YouTube") : track.preset ? "Synthesized" : "Upload"}
            </span>
            {track.duration && <span className="src-badge neutral"><Clock size={13} />{formatDuration(track.duration)}</span>}
            <span className="src-badge neutral">{track.instrumental ? "Instrumental" : "Vocal"}</span>
          </div>

          <h1 className="hero-title">{track.title}</h1>

          <div className="artist-row">
            <Link href={`/profile/${artist.handle}`} className="artist-link">
              <span className="avatar-ring" style={{ width: 48, height: 48 }}>
                <img className="avatar-img" src={avatarUrl(artist.name, artist.avatarPalette)} alt={artist.name} width={42} height={42} />
              </span>
              <span>
                <strong>{artist.name}</strong>
                <em>@{artist.handle} · <time dateTime={new Date(track.createdAt).toISOString()}>{absoluteDate(track.createdAt)}</time></em>
              </span>
            </Link>
          </div>

          {track.background && <p className="seo-lead">{track.background.split(". ")[0]}.</p>}
          <TrackActions trackId={track.id} />

          <dl className="seo-facts">
            <div><dt>Artist</dt><dd><Link href={`/profile/${artist.handle}`}>{artist.name}</Link></dd></div>
            <div><dt>Published</dt><dd><time dateTime={new Date(track.createdAt).toISOString()}>{absoluteDate(track.createdAt)}</time></dd></div>
            <div><dt>Source</dt><dd>{track.source === "youtube" ? "YouTube embed" : track.preset ? "Browser-synthesized audio" : "Direct upload"}</dd></div>
            {isoDuration(track.duration) && <div><dt>Duration</dt><dd>{formatDuration(track.duration)}</dd></div>}
            <div><dt>Plays</dt><dd>{formatCount(track.plays)}</dd></div>
            <div><dt>Likes</dt><dd>{formatCount(likeCount)}</dd></div>
            <div><dt>Lyrics</dt><dd>{track.instrumental ? "Instrumental" : "Full lyrics published"}</dd></div>
          </dl>
        </div>
      </article>

      {track.source === "youtube" && track.youtubeId && <TrackEmbed trackId={track.id} youtubeId={track.youtubeId} />}

      <TrackTrust trackId={track.id} title={track.title} ownerPublicId={artist.id} initialRights={rights} />

      {track.stylePrompt && (
        <section className="section seo-section" id="prompt">
          <h2 className="section-title"><Wand2 size={18} />Style / Prompt</h2>
          <div className="prompt-block"><p>{track.stylePrompt}</p><TrackPromptCopy prompt={track.stylePrompt} /></div>
          {tags.length > 0 && <div className="seo-tagrow">{tags.map((t) => <Link key={t} className="chip" href={`/discover?tag=${encodeURIComponent(t)}`}>{t}</Link>)}</div>}
        </section>
      )}

      {track.background && (
        <section className="section seo-section" id="background">
          <h2 className="section-title"><BookOpen size={18} />Background — the story behind {track.title}</h2>
          <p className="prose">{track.background}</p>
        </section>
      )}

      <section className="section seo-section" id="lyrics">
        <h2 className="section-title"><Music2 size={18} />Lyrics</h2>
        {track.instrumental || !track.lyrics.trim() ? (
          <div className="instru"><Disc3 size={34} className="slow-spin" /><div><strong>Instrumental</strong><p>No lyrics — let the frequencies do the talking.</p></div></div>
        ) : <LyricBlocks lyrics={track.lyrics} />}
      </section>

      <TrackComments trackId={track.id} />

      {related.length > 0 && (
        <section className="section seo-section" id="related">
          <h2 className="section-title"><Headphones size={18} />More from {artist.name}</h2>
          <ul className="seo-tracklist">
            {related.map((t) => (
              <li key={t.id}>
                <PlayButton trackId={t.id} queue={[track.id, ...related.map((x) => x.id)]} size="sm" />
                <div>
                  <Link href={`/track/${t.id}`} className="seo-tracklist-title">{t.title}</Link>
                  <p>{t.stylePrompt}</p>
                </div>
                <span className="seo-tracklist-meta">{t.instrumental ? "Instrumental" : "Vocal"} · {formatCount(t.plays)} plays</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TrackRelated trackId={track.id} />

      <section className="seo-context">
        <h2>About this track</h2>
        <p>
          <strong>{track.title}</strong> is an {track.instrumental ? "instrumental" : "AI-assisted vocal"} track published by{" "}
          <Link href={`/profile/${artist.handle}`}>{artist.name}</Link> on {SITE.name}. The provenance panel above records the
          licence, the AI tool used and the creator&apos;s human contribution. The style prompt is copyable so other producers can
          study the wording and hear how small changes move the result.
        </p>
        <p>
          <Link href="/discover">Browse the catalog</Link> · <Link href="/legal/dmca">Copyright &amp; takedown policy</Link> · <Link href="/create">Post your own track</Link>
        </p>
      </section>
    </div>
  );
}