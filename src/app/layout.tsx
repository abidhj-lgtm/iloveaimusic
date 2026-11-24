import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import "./seo.css";
import "./sync.css";
import "./trust.css";
import "./slice1.css";
import "./ops.css";
import { Providers } from "@/components/providers";
import { ErrorReporter } from "@/components/error-reporter";
import { SITE, absoluteUrl, ogImageUrl, websiteJsonLd, organizationJsonLd, jsonLdScript } from "@/lib/seo";
import { CATALOG_TRACKS, CATALOG_ARTISTS } from "@/lib/catalog";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name, keywords: SITE.keywords,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name, publisher: SITE.name, category: "music",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: absoluteUrl("/"), types: { "application/rss+xml": absoluteUrl("/feed.xml") } },
  openGraph: {
    type: "website", url: absoluteUrl("/"), siteName: SITE.name, locale: SITE.locale,
    title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description,
    images: [{ url: ogImageUrl({ title: SITE.name, subtitle: SITE.tagline, kind: "site" }), width: 1200, height: 630, alt: SITE.name }]
  },
  twitter: {
    card: "summary_large_image", site: SITE.twitter, creator: SITE.twitter,
    title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description,
    images: [ogImageUrl({ title: SITE.name, subtitle: SITE.tagline, kind: "site" })]
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], shortcut: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.shortName, statusBarStyle: "black-translucent" },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined
  }
};

export const viewport: Viewport = { themeColor: "#0a0712", width: "device-width", initialScale: 1, colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site summary" />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(websiteJsonLd())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd())} />
      </head>
      <body>
        <ErrorReporter />
        <Providers>{children}</Providers>
        <noscript>
          <div className="seo-noscript">
            <h1>{SITE.name} — {SITE.tagline}</h1>
            <p>{SITE.description}</p>
            <h2>Latest tracks</h2>
            <ul>{CATALOG_TRACKS.map((t) => <li key={t.id}><Link href={`/track/${t.id}`}>{t.title}</Link> — {t.stylePrompt}</li>)}</ul>
            <h2>Artists</h2>
            <ul>{CATALOG_ARTISTS.map((a) => <li key={a.id}><Link href={`/profile/${a.handle}`}>{a.name}</Link> — {a.bio}</li>)}</ul>
            <p><Link href="/discover">Catalog</Link> · <Link href="/faq">FAQ</Link> · <Link href="/about">About</Link> · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/dmca">Copyright</Link></p>
          </div>
        </noscript>
      </body>
    </html>
  );
}