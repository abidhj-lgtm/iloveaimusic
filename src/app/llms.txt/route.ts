import { SITE, absoluteUrl } from "@/lib/seo";
import { publicCatalog } from "@/server/content-service";

export const revalidate = 3600;

export async function GET() {
  const head = `# ${SITE.name}

> ${SITE.description}

Site: https://${SITE.domain}
Handle: ${SITE.twitter}

${SITE.name} is a community feed for music made with AI tools. Every track is published with
the exact style prompt fed to the model, the story behind the session, the lyrics where words
exist, and a provenance record naming the AI tool, the licence and the human contribution.
The feed is chronological with no engagement ranking. Visitors can listen without an account;
a verified account is required to post, like, save, comment or follow.

## Core pages

- [Home feed](${absoluteUrl("/")})
- [Discover catalog](${absoluteUrl("/discover")})
- [FAQ](${absoluteUrl("/faq")})
- [About](${absoluteUrl("/about")})
- [Terms](${absoluteUrl("/legal/terms")}) · [Privacy](${absoluteUrl("/legal/privacy")}) · [Copyright & takedown](${absoluteUrl("/legal/dmca")})
`;

  let body = "";
  try {
    const { entries, total } = await publicCatalog(400);
    body += `\n## Tracks (${total} published)\n\n`;
    body += entries.slice(0, 120).map((t) =>
      `- [${t.title}](${absoluteUrl(`/track/${t.id}`)}) — ${t.artistName} · ${t.stylePrompt.slice(0, 120)}`
    ).join("\n");

    const artists = new Map<string, { name: string; handle: string; bio: string }>();
    for (const t of entries) if (!artists.has(t.userId)) artists.set(t.userId, { name: t.artistName, handle: t.artistHandle, bio: t.artistBio });
    body += `\n\n## Artists (${artists.size})\n\n`;
    body += [...artists.values()].map((a) =>
      `- [${a.name}](${absoluteUrl(`/profile/${a.handle}`)}) — ${a.bio.slice(0, 140)}`
    ).join("\n");
  } catch {
    body += "\nCatalog temporarily unavailable.\n";
  }

  const tail = `\n\n## Rights\n\nCreators retain their rights and attest to them at upload. Style prompts are published to be\ncopied and adapted. Copyright: ${SITE.legalEmail}. Moderation: ${SITE.moderationEmail}.\nGeneral: ${SITE.email}.\n\n## Machine-readable\n\n- [Sitemap](${absoluteUrl("/sitemap.xml")})\n- [RSS](${absoluteUrl("/feed.xml")})\n- [Health](${absoluteUrl("/api/health")})\n- JSON-LD: WebSite, Organization, MusicRecording, MusicComposition, VideoObject, ProfilePage, ItemList, FAQPage, BreadcrumbList.\n`;

  return new Response(head + body + tail, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" }
  });
}