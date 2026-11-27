"use client";

import React from "react";
import { Twitter, Facebook, Link2 } from "lucide-react";
import { SITE } from "@/lib/seo";

export function OGPreview({ title, subtitle, type = "track", imageUrl }: {
  title: string; subtitle: string; type?: string; imageUrl?: string;
}) {
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://iloveaimusic.com";
  const ogUrl = `${siteUrl}/api/og?type=${type}&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ""}`;

  return (
    <div className="og-preview-card">
      <h4 className="og-preview-title">How this will look when shared</h4>
      
      <div className="og-preview-mock">
        <img src={ogUrl} alt="OpenGraph Preview" className="og-preview-image" />
        <div className="og-preview-meta">
          <div className="og-preview-domain">{siteUrl.replace("https://", "")}</div>
          <div className="og-preview-text-title">{title}</div>
          <div className="og-preview-text-desc">{subtitle}</div>
        </div>
      </div>

      <div className="og-preview-actions">
        <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(siteUrl)}`} target="_blank" rel="noopener noreferrer" className="og-btn twitter">
          <Twitter size={16} /> Share on X
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`} target="_blank" rel="noopener noreferrer" className="og-btn facebook">
          <Facebook size={16} /> Share on Facebook
        </a>
        <button className="og-btn copy" onClick={() => navigator.clipboard.writeText(siteUrl)}>
          <Link2 size={16} /> Copy Link
        </button>
      </div>
    </div>
  );
}