"use client";

import Link from "next/link";
import { Home, Sparkles } from "lucide-react";
import { Eq } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="nf">
      <div className="nf-code">4<Eq playing />4</div>
      <h1>This frequency doesn't exist.</h1>
      <p>The page you tuned into is static. Head back to the feed — there's music there.</p>
      <div className="nf-actions">
        <Link href="/" className="btn btn-brand"><Home size={16} />Back to the feed</Link>
        <Link href="/create" className="btn btn-ghost"><Sparkles size={16} />Post music</Link>
      </div>
    </div>
  );
}