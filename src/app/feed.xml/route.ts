import { SITE, absoluteUrl } from "@/lib/seo";
import { publicCatalog } from "@/server/content-service";

export const revalidate = 1800;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET() {
  let items = "";
  try {
    const { entries } = await publicCatalog(60);
    items = entries.slice(0, 50).map((t) => {
      const url = absoluteUrl(`/track/${t.id}`);
      const desc = `${t.background} Style prompt: ${t.stylePrompt}`.slice(0, 500);
      return `    <item>
      <title>${esc(t.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(t.createdAt).toUTCString()}</pubDate>
      <dc:creator>${esc(t.artistName)}</dc:creator>
      <category>${esc(t.source === "youtube" ? "YouTube" : t.preset ? "Synthesized" : "Upload")}</category>
      <description>${esc(desc)}</description>
    </item>`;
    }).join("\n");
  } catch { /* serve a valid empty channel rather than a 500 */ }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${SITE.url}</link>
    <atom:link href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=1800, s-maxage=1800" }
  });
}