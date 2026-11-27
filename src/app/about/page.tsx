import type { Metadata } from "next";
import Link from "next/link";
import { Info, ShieldCheck, Wand2, Music2, Mail, Scale, Eye } from "lucide-react";
import { pageMetadata, ogImageUrl, breadcrumbJsonLd, jsonLdScript, SITE, absoluteUrl } from "@/lib/seo";
import { CATALOG_TRACKS, CATALOG_ARTISTS } from "@/lib/catalog";

export const metadata: Metadata = pageMetadata({
  title: "About — why the prompt belongs next to the song",
  description: "I Love AI Music publishes AI-generated tracks together with their style prompts, session stories and lyrics. Read the editorial standards, rights policy, takedown process and contact details.",
  path: "/about",
  image: ogImageUrl({ title: "About I Love AI Music", subtitle: "The track · the story · the prompt · the lyrics", palette: 0, kind: "about" }),
  keywords: ["about I Love AI Music", "AI music platform", "AI music editorial standards", "AI music rights policy", "AI music takedown"]
});

const PILLARS = [
  { icon: <Music2 size={19} />, title: "The track", body: "Uploaded audio with cover art, an official YouTube embed, or audio synthesized live in your browser. One persistent player carries all three without breaking playback as you browse." },
  { icon: <Info size={19} />, title: "The background", body: "What the creator was chasing, which render failed, what changed between take four and take seven. The process is the interesting part, so it gets its own field instead of a caption." },
  { icon: <Wand2 size={19} />, title: "The prompt", body: "The literal text fed to the model, published in a copyable block with one-tap copy. Prompts are ideas meant to be studied, adapted and argued about." },
  { icon: <Eye size={19} />, title: "The lyrics", body: "Line breaks preserved, [Verse] and [Chorus] markers turned into styled section labels, and a dignified instrumental panel when there are no words at all." }
];

const STANDARDS = [
  "Every track declares its source: direct upload, YouTube embed, or browser-synthesized audio.",
  "Creators attest they hold the rights to the audio, lyrics, samples and cover art they post.",
  "The AI tool and the human contribution are recorded so listeners know what they are hearing.",
  "A licence field tells you whether a track can be reused, and under what conditions.",
  "Reports enter a moderation queue; disputed material can be hidden while a claim is reviewed.",
  "Repeat infringement leads to suspension. Every moderator action is written to an audit log.",
  "The feed is chronological. No engagement algorithm quietly reorders what you see."
];

export default function AboutPage() {
  const crumbs = [{ name: "Home", path: "/" }, { name: "About", path: "/about" }];
  const aboutLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: absoluteUrl("/about"),
    name: `About ${SITE.name}`,
    description: SITE.description,
    mainEntity: { "@id": `${SITE.url}/#organization` }
  };

  return (
    <div className="seo-page seo-reading">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(aboutLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <header className="seo-hero">
        <span className="seo-eyebrow"><Info size={15} />Est. {SITE.foundingYear} · {CATALOG_TRACKS.length} tracks · {CATALOG_ARTISTS.length} artists</span>
        <h1>The prompt belongs next to the song.</h1>
        <p>
          AI music arrived faster than the culture around it. Files got shared, prompts got lost, and nobody recorded
          which words produced which sound. {SITE.name} fixes the filing problem: four fields, one feed, and the
          process published alongside the result.
        </p>
      </header>

      <section className="seo-section">
        <h2 className="section-title"><Music2 size={18} />The four pillars</h2>
        <div className="seo-pillars">
          {PILLARS.map((p) => (
            <article key={p.title} className="seo-pillar">
              <span className="seo-pillar-icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-section">
        <h2 className="section-title"><Scale size={18} />Editorial and rights standards</h2>
        <ul className="seo-standards">
          {STANDARDS.map((s) => <li key={s}><ShieldCheck size={15} /><span>{s}</span></li>)}
        </ul>
        <p className="prose">
          AI-generated music occupies unsettled legal ground. The platform does not claim copyright over creator work and
          does not grant rights it does not hold. It records provenance, surfaces licences, and removes disputed material
          quickly while a claim is examined.
        </p>
      </section>

      <section className="seo-section">
        <h2 className="section-title"><Wand2 size={18} />How the technology works</h2>
        <p className="prose">
          The interface is Next.js with the App Router. Track pages, artist profiles, this page and the catalog are
          rendered on the server, so search engines and answer engines read real content rather than an empty shell.
          The interactive layer — the feed, the player, likes, comments and the posting form — hydrates on top.
          Uploaded audio and thumbnails are held in IndexedDB; accounts and preferences in localStorage; and the
          Synth tracks are rendered from scratch with the Web Audio API on first play, then cached.
        </p>
        <p className="prose">
          The production path replaces that browser layer with Postgres, real Gmail verification, signed cloud uploads,
          an FFmpeg processing worker, moderation tooling and monitoring — without changing a pixel of the interface
          you are looking at.
        </p>
      </section>

      <section className="seo-section" id="contact">
        <h2 className="section-title"><Mail size={18} />Contact and takedowns</h2>
        <dl className="seo-facts wide">
          <div><dt>General</dt><dd><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd></div>
          <div><dt>Copyright / takedown</dt><dd><a href={`mailto:legal@ilistenai.music?subject=Takedown%20request`}>legal@ilistenai.music</a></dd></div>
          <div><dt>Moderation</dt><dd><a href={`mailto:moderation@ilistenai.music`}>moderation@ilistenai.music</a></dd></div>
          <div><dt>Response target</dt><dd>Within 2 business days for rights claims</dd></div>
        </dl>
        <p className="prose">
          A takedown request should identify the track URL, the work you hold rights in, proof of ownership, and a
          contact address. Disputed material is hidden pending review rather than left public.
        </p>
      </section>

      <section className="seo-cta">
        <div><Music2 size={22} /><h2>Bring your renders.</h2></div>
        <p>Post a track with its story, its prompt and its words — and let the feed do the rest.</p>
        <div className="seo-cta-actions">
          <Link href="/create" className="btn btn-brand">Post music</Link>
          <Link href="/discover" className="btn btn-ghost">Browse the catalog</Link>
          <Link href="/faq" className="btn btn-ghost">Read the FAQ</Link>
        </div>
      </section>
    </div>
  );
}