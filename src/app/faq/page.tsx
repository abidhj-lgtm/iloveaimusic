import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, ShieldCheck, Wand2, Music2 } from "lucide-react";
import { pageMetadata, ogImageUrl, faqJsonLd, breadcrumbJsonLd, jsonLdScript, SITE } from "@/lib/seo";

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is I Love AI Music?",
    a: "I Love AI Music is a community feed for AI-generated music. Creators post a track — either uploaded from their computer or embedded from YouTube — and publish four things alongside it: the title, the background story of the session, the exact style prompt fed to the model, and the lyrics. Everything appears in a chronological, newest-first feed with a persistent player that keeps playing while you browse."
  },
  {
    q: "Can I upload music I made with Suno, Udio or another AI tool?",
    a: "Yes. Upload an MP3, WAV, M4A or OGG file up to 40MB, add a square thumbnail, and fill in the background, style prompt and lyrics fields. You must have the rights to the material you upload, including any samples, vocals, lyrics and cover art. Each upload includes a rights attestation, and the AI tool used can be declared on the track."
  },
  {
    q: "Why does the site ask for the style prompt?",
    a: "Because the prompt is the most useful thing an AI musician can share. A finished track tells you what happened; the prompt tells you how to get there. Every prompt on the site is displayed in a copyable block, so you can study the wording, change one variable — key, BPM, mood, instrumentation — and hear how the result moves."
  },
  {
    q: "How does YouTube embedding work?",
    a: "Paste any YouTube URL — watch, youtu.be, shorts or live links all work. The site extracts the video ID, pulls the thumbnail automatically, and plays the video through the official YouTube player in the persistent player bar and on the track page. Audio is never downloaded or ripped from YouTube; only the official embed is used."
  },
  {
    q: "What does the 'Synth' badge mean?",
    a: "Tracks marked Synth are synthesized live in your browser using the Web Audio API. On first play, the app renders an original piece from a preset — synthwave at 100 BPM in A minor, lo-fi at 74 BPM with swung hats and vinyl crackle, or a free-time ambient drift — encodes it to WAV, and caches it locally. Nothing is streamed from a server, and the audio is genuinely generated on your machine."
  },
  {
    q: "Do I need an account to listen?",
    a: "No. The feed, every track page, artist profiles and the catalog are public and readable without an account. You need a verified account to post music, like tracks, save them to a collection, comment, or follow artists."
  },
  {
    q: "How does Gmail verification work?",
    a: "Sign up with your name, Gmail address and a password of at least eight characters. A verification link valid for 24 hours is sent to that address. Clicking it activates the account and unlocks login. You can also use Continue with Google, which verifies instantly. In this self-contained build the verification email appears in an on-screen Demo inbox instead of a real mailbox, so the whole flow can be completed without any email API keys."
  },
  {
    q: "Who owns the music posted here?",
    a: "The creator retains whatever rights they hold in their work. Posting does not transfer ownership. Because AI-generated music has an unsettled copyright status in many jurisdictions, the site records the AI tool used, the human contribution, and the licence the creator chooses, and it operates a report-and-takedown process for disputed material."
  },
  {
    q: "Can I use a track I find here in my own project?",
    a: "Only if the licence on that track permits it. Check the licence field and contact the artist through their profile before using any track commercially. The style prompt, by contrast, is published specifically to be copied and adapted — prompts are ideas, not recordings."
  },
  {
    q: "How is the feed ordered?",
    a: "Chronologically, newest first, by default. There is no engagement-ranking algorithm deciding what you see. You can switch to oldest first, most liked or most played, and filter to Uploads and synths, YouTube, Following, Liked or Saved. Your filter and sort choice is remembered between visits."
  },
  {
    q: "Is my data stored on a server?",
    a: "In this build, no. Accounts, tracks, likes, comments and preferences live in your browser's localStorage, and uploaded audio and thumbnails live in IndexedDB. That means the app runs with zero API keys and no backend, but your studio is private to that browser. The production architecture replaces that layer with Postgres, real authentication and cloud storage without changing the interface."
  },
  {
    q: "How do I report a track that infringes my rights?",
    a: "Use the report action on any track and choose Copyright. Reports enter a moderation queue where the material can be hidden or removed while the claim is reviewed, and repeat infringement leads to account suspension. A dedicated takedown contact is published on the About page."
  }
];

export const metadata: Metadata = pageMetadata({
  title: "FAQ — AI music, prompts, rights and how the feed works",
  description: "Answers about uploading AI-generated music, sharing style prompts, YouTube embedding, Gmail verification, licensing, takedowns and how the chronological feed is ordered.",
  path: "/faq",
  image: ogImageUrl({ title: "Frequently asked questions", subtitle: "AI music, prompts, rights", palette: 2, kind: "faq" }),
  keywords: ["AI music FAQ", "can I upload Suno music", "AI music copyright", "AI music prompt sharing", "YouTube music embed", "AI music licensing"]
});

export default function FaqPage() {
  const crumbs = [{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }];
  return (
    <div className="seo-page seo-reading">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(FAQ))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd(crumbs))} />

      <header className="seo-hero">
        <span className="seo-eyebrow"><HelpCircle size={15} />Answers, not marketing</span>
        <h1>Frequently asked questions</h1>
        <p>Everything about posting AI music, sharing prompts, embedding YouTube, verifying your Gmail, and who owns what.</p>
      </header>

      <nav className="seo-toc" aria-label="Jump to a question">
        {FAQ.map((f, i) => <a key={i} href={`#q${i + 1}`}>{f.q}</a>)}
      </nav>

      <div className="seo-faq">
        {FAQ.map((f, i) => (
          <section key={i} className="seo-faq-item" id={`q${i + 1}`}>
            <h2><span className="seo-faq-num">{String(i + 1).padStart(2, "0")}</span>{f.q}</h2>
            <p>{f.a}</p>
          </section>
        ))}
      </div>

      <section className="seo-cta">
        <div><ShieldCheck size={22} /><h2>Ready to post your first track?</h2></div>
        <p>Verify your Gmail, add a title, drop in audio or a YouTube link, and publish the prompt alongside it.</p>
        <div className="seo-cta-actions">
          <Link href="/create" className="btn btn-brand"><Music2 size={16} />Post music</Link>
          <Link href="/discover" className="btn btn-ghost"><Wand2 size={16} />Browse the catalog</Link>
        </div>
      </section>
    </div>
  );
}