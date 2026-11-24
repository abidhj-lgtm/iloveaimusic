import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Scale, ShieldCheck, Mail, ArrowLeft, FileWarning } from "lucide-react";
import { pageMetadata, breadcrumbJsonLd, jsonLdScript, SITE, absoluteUrl } from "@/lib/seo";

const UPDATED = "23 November 2026";
const N = SITE.name;
const D = SITE.domain;

const DOCS = {
  terms: {
    title: "Terms of Service",
    lede: `The agreement between you and ${N} when you post, listen to, or reuse music here.`,
    icon: <Scale size={16} />,
    sections: [
      { h: "1. What this service is", p: [`${N} (${D}) is a community feed for music created with AI tools. Each post pairs a track with the story behind it, the style prompt used to generate it, and its lyrics where words exist. We host, index and display that material; we do not claim ownership of it.`] },
      { h: "2. Your account", p: ["You must verify your email address before posting, commenting, liking, saving or following. You are responsible for activity under your account and for keeping your password secure. One person may not operate accounts that impersonate another artist.", "We may suspend accounts that accumulate policy strikes, repeatedly infringe rights, or attempt to abuse the feed, the player metrics or the reporting system."] },
      { h: "3. What you may post", p: ["Only material you have the right to publish. That includes the recording, any samples, any vocals, the lyrics, and the cover art. Every upload requires an explicit rights attestation, and every track carries a provenance declaration naming the AI tool used and your human contribution.", "You may not post material that infringes copyright, targets a person or group with abuse, is sexually explicit involving minors, is malware disguised as audio, or is deliberately mislabelled to evade the explicit-content flag."] },
      { h: "4. Ownership and licence", p: ["You keep whatever rights you hold in your work. Posting grants us a non-exclusive licence to host, stream, cache, index, display and promote your post within this service, and to generate previews and social images for it.", "The licence you choose in the provenance panel governs what other users may do with your recording. Style prompts are published deliberately so other creators can copy and adapt them; prompts are ideas, not recordings."] },
      { h: "5. AI disclosure", p: ["Because AI-generated music has an unsettled copyright status in many jurisdictions, we record provenance rather than assert ownership. Declaring a tool does not guarantee that an output is copyrightable, and we make no representation that it is.", "You are responsible for complying with the terms of the AI tool you used, including any restrictions on commercial use."] },
      { h: "6. Moderation", p: ["Reports are reviewed by human moderators. We may hide, remove, relabel or restore content, and we may issue strikes against accounts. Every moderation decision is written to an audit log. Destructive actions are reversible internally for a short period.", `If your content is removed you may contact ${SITE.moderationEmail} with the track URL and a statement. We aim to answer within two business days.`] },
      { h: "7. Availability", p: ["The service is provided as-is. We do not guarantee uninterrupted availability, permanent storage of any particular track, or that play counts and other metrics are free of error. Keep your own masters."] },
      { h: "8. Changes", p: ["We may update these terms. Material changes will be announced on the site. Continuing to use the service after a change means you accept it."] }
    ]
  },
  privacy: {
    title: "Privacy Policy",
    lede: "What we store, why we store it, and how you get rid of it.",
    icon: <ShieldCheck size={16} />,
    sections: [
      { h: "1. What we collect", p: ["Account data: your name, artist handle, email address, a salted scrypt hash of your password, your bio and avatar palette. We never store your password in readable form.", "Content data: tracks you post, audio and cover files you upload, background stories, style prompts, lyrics, comments, likes, saves, follows and reports you file.", "Technical data: your IP address and browser user-agent, recorded against sessions and audit events for abuse prevention. Play events store a hashed IP, not the raw address."] },
      { h: "2. Why we collect it", p: ["To operate your account, deliver verification and password-reset email, display your posts, prevent spam and fraud, enforce rights policy, and keep an audit trail of moderation decisions. We do not sell your data."] },
      { h: "3. Cookies", p: ["We set one essential cookie holding a random session token, hashed at rest, HTTP-only and SameSite=Lax. If you use Google sign-in we set a short-lived state cookie to prevent cross-site request forgery. In development a scoped inbox cookie lets you see your own verification mail.", "We do not currently set advertising or analytics cookies. If that changes, this policy will be updated and consent will be requested where required."] },
      { h: "4. Where data lives", p: ["In production, data lives in a managed Postgres database and private object storage. Original audio uploads are private and served only when a track is public or you own it. Covers and derivative streams may be served through a content delivery network.", "In the self-contained development build, everything lives on the machine running the server: a JSON store and a media folder. Nothing leaves that machine."] },
      { h: "5. Who can see what", p: ["Your name, handle, bio, avatar and public tracks are visible to everyone, including search engines. Your email address is visible only to you and to staff acting on a support or rights request. Reports you file are visible to moderators."] },
      { h: "6. Retention and deletion", p: ["Deleted tracks are soft-deleted so they can be restored, then purged. Sessions expire after thirty days. Verification links expire after twenty-four hours and password-reset links after one hour.", `You may request account deletion and a copy of your data by writing to ${SITE.email} from your registered address. We will remove your profile, tracks and media within thirty days, except records we must retain for rights disputes.`] },
      { h: "7. Your rights", p: [`Depending on where you live you may have rights to access, correct, export, restrict or erase your personal data, and to object to processing. Contact ${SITE.email} and we will respond within thirty days.`] },
      { h: "8. Contact", p: [`Data controller: ${N}, ${D}. Privacy enquiries: ${SITE.email}. Rights disputes: ${SITE.legalEmail}.`] }
    ]
  },
  dmca: {
    title: "Copyright & Takedown Policy",
    lede: "How to report infringement, what happens next, and how to dispute a removal.",
    icon: <FileWarning size={16} />,
    sections: [
      { h: "1. Our position", p: ["We do not permit posting of material that infringes copyright. Because this platform hosts AI-generated music, we take provenance seriously: every upload requires a rights attestation and a declaration of the AI tool used, the human contribution, and any third-party samples."] },
      { h: "2. Reporting from the site", p: ["Every track and every comment carries a Report action. Choose Copyright, describe the work you own and where it appears, and submit. That creates a case in the moderation queue immediately. Copyright cases are prioritised above all other categories."] },
      { h: "3. Formal takedown notice", p: [`For a formal notice, email ${SITE.legalEmail} with the subject line “Takedown request” and include:`, "• the URL of the track or comment on this site;", "• identification of the copyrighted work you claim is infringed;", "• proof that you own or are authorised to act for the rights holder;", "• your name, organisation, postal address, telephone and email;", "• a statement that you have a good-faith belief the use is not authorised;", "• a statement that the information is accurate and, under penalty of perjury, that you are authorised to act."] },
      { h: "4. What we do", p: ["We acknowledge within two business days. Where the claim is credible we hide the material pending review rather than leaving it public. The uploader is notified and may respond. Confirmed infringement results in removal and a policy strike.", "Repeat infringement leads to account suspension. Every action, including restoration, is recorded in an audit log with the acting moderator and the reason."] },
      { h: "5. Counter-notice", p: [`If you believe your material was removed in error, reply to the removal notice or write to ${SITE.legalEmail} with the track URL, an explanation of your right to post it, and your contact details. We may restore the material after review unless the claimant pursues the matter formally.`] },
      { h: "6. YouTube embeds", p: ["Some posts embed a YouTube video using the official player. We never download or re-host YouTube audio. If an embedded video infringes your rights, please also report it to YouTube directly, since the underlying file is hosted there. We will remove the post from this site on a valid claim."] },
      { h: "7. Good faith", p: ["Knowingly misrepresenting that material infringes may expose you to liability. Please consider whether the use is licensed, de minimis, or otherwise permitted before filing."] }
    ]
  }
} as const;

type DocKey = keyof typeof DOCS;

export function generateStaticParams() {
  return [{ doc: "terms" }, { doc: "privacy" }, { doc: "dmca" }];
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = DOCS[doc as DocKey];
  if (!d) return pageMetadata({ title: "Legal", description: "Legal policies.", path: "/legal/terms", noindex: true });
  return pageMetadata({
    title: d.title, description: d.lede, path: `/legal/${doc}`,
    keywords: [d.title, `${N} policy`, "AI music copyright", "AI music licensing", D]
  });
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc as DocKey];
  if (!d) notFound();

  const crumbs = [{ name: "Home", path: "/" }, { name: d.title, path: `/legal/${doc}` }];
  const ld = {
    "@context": "https://schema.org", "@type": "WebPage",
    url: absoluteUrl(`/legal/${doc}`), name: d.title, description: d.lede,
    dateModified: "2026-11-23", inLanguage: "en", isPartOf: { "@id": `${SITE.url}/#website` }
  };

  return (
    <div className="seo-page seo-reading legal">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <nav className="seo-crumbs" aria-label="Breadcrumb">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Feed</Link>
        <span aria-hidden>/</span><span aria-current="page">{d.title}</span>
      </nav>

      <header className="seo-hero">
        <span className="seo-eyebrow">{d.icon}Last updated {UPDATED}</span>
        <h1>{d.title}</h1>
        <p>{d.lede}</p>
      </header>

      <nav className="legal-switch" aria-label="Legal documents">
        {(Object.keys(DOCS) as DocKey[]).map((k) => (
          <Link key={k} className={`chip${k === doc ? " active" : ""}`} href={`/legal/${k}`}>{DOCS[k].title}</Link>
        ))}
      </nav>

      <div className="legal-body">
        {d.sections.map((s) => (
          <section key={s.h} className="legal-sec" id={s.h.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}>
            <h2>{s.h}</h2>
            {s.p.map((para, i) => <p key={i}>{para}</p>)}
          </section>
        ))}
      </div>

      <section className="seo-cta">
        <div><Mail size={22} /><h2>Need to reach a human?</h2></div>
        <p>Rights disputes: {SITE.legalEmail}. Moderation appeals: {SITE.moderationEmail}. Everything else: {SITE.email}.</p>
        <div className="seo-cta-actions">
          <a className="btn btn-brand" href={`mailto:${SITE.legalEmail}?subject=Takedown%20request`}>File a takedown</a>
          <Link href="/faq" className="btn btn-ghost">Read the FAQ</Link>
          <Link href="/about" className="btn btn-ghost">About the platform</Link>
        </div>
      </section>
    </div>
  );
}