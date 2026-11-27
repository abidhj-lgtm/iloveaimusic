import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadFeed } from "@/server/content-service";
import { TrackCard } from "@/components/track-card";
import { resolveSession } from "@/server/session";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function MoodPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const mood = decodeURIComponent(name).toLowerCase();
  
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const viewer = await resolveSession(cookie);

  const page = await loadFeed({
    viewerId: viewer?.id ?? null,
    sort: "new",
    view: "all",
    q: "",
    mood,
    limit: 50,
    cursor: null
  });

  if (page.items.length === 0) {
    notFound();
  }

  return (
    <div className="mood-page">
      <nav className="seo-crumbs" aria-label="Breadcrumb">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Feed</Link>
        <span aria-hidden>/</span>
        <Link href="/discover">Discover</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{mood}</span>
      </nav>

      <header className="mood-header">
        <h1 className="mood-title">{mood}</h1>
        <p className="mood-subtitle">{page.items.length} track{page.items.length === 1 ? "" : "s"} with this mood</p>
      </header>

      <div className="feed-grid">
        {page.items.map((item) => (
          <TrackCard key={item.track.id} track={item.track} />
        ))}
      </div>
    </div>
  );
}