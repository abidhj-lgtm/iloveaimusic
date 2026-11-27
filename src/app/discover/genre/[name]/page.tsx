import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadFeed } from "@/server/content-service";
import { TrackCard } from "@/components/track-card";
import { resolveSession } from "@/server/session";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function GenrePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const genre = decodeURIComponent(name).toLowerCase();
  
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const viewer = await resolveSession(cookie);

  const page = await loadFeed({
    viewerId: viewer?.id ?? null,
    sort: "new",
    view: "all",
    q: "",
    genre,
    limit: 50,
    cursor: null
  });

  if (page.items.length === 0) {
    notFound();
  }

  return (
    <div className="genre-page">
      <nav className="seo-crumbs" aria-label="Breadcrumb">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Feed</Link>
        <span aria-hidden>/</span>
        <Link href="/discover">Discover</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{genre}</span>
      </nav>

      <header className="genre-header">
        <h1 className="genre-title">{genre}</h1>
        <p className="genre-subtitle">{page.items.length} track{page.items.length === 1 ? "" : "s"} in this genre</p>
      </header>

      <div className="feed-grid">
        {page.items.map((item) => (
          <TrackCard key={item.track.id} track={item.track} />
        ))}
      </div>
    </div>
  );
}