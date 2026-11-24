import type { MetadataRoute } from "next";
import { SITE, absoluteUrl } from "@/lib/seo";

const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "Google-Extended",
  "Applebot", "Applebot-Extended", "Bingbot", "Amazonbot", "CCBot", "Bytespider",
  "meta-externalagent", "meta-externalfetcher", "cohere-ai", "Diffbot", "YouBot",
  "DuckAssistBot", "MistralAI-User", "AI2Bot", "Timpibot", "ImagesiftBot"
];

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/create", "/verify", "/login", "/signup", "/settings", "/api/", "/?new="];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths, crawlDelay: 1 },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths }))
    ],
    sitemap: [absoluteUrl("/sitemap.xml"), absoluteUrl("/feed.xml")],
    host: SITE.url
  };
}