"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";
import { reportClientError } from "@/components/error-reporter";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error, "route-error-boundary"); }, [error]);

  return (
    <div className="nf">
      <div className="nf-code">5<span className="nf-zero">0</span>0</div>
      <h1>A string snapped backstage.</h1>
      <p>Something went wrong rendering this page. The error has been reported. Reset the stage and try again.</p>
      {error.digest && <p className="hint">Reference: {error.digest}</p>}
      <div className="nf-actions">
        <button className="btn btn-brand" onClick={reset}><RefreshCw size={16} />Try again</button>
        <Link href="/" className="btn btn-ghost"><Home size={16} />Back to the feed</Link>
      </div>
    </div>
  );
}