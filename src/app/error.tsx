"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-icon">
          <AlertTriangle size={48} />
        </div>
        <h1>Something went wrong</h1>
        <p className="error-message">
          We hit a snag while loading this page. Don't worry — your music is safe.
        </p>
        {error.digest && (
          <p className="error-digest">
            Error ID: <code>{error.digest}</code>
          </p>
        )}
        <div className="error-actions">
          <button onClick={reset} className="btn btn-brand">
            <RefreshCw size={16} /> Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            <Home size={16} /> Back to home
          </Link>
        </div>
      </div>
      <style jsx>{`
        .error-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: var(--bg, #0a0712);
        }
        .error-content {
          max-width: 500px;
          text-align: center;
        }
        .error-icon {
          margin-bottom: 1.5rem;
          color: var(--amber, #fbbf24);
        }
        h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #f4efff;
        }
        .error-message {
          font-size: 1.125rem;
          color: var(--muted, #a8a29e);
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        .error-digest {
          font-size: 0.875rem;
          color: var(--faint, #78716c);
          margin-bottom: 2rem;
        }
        .error-digest code {
          background: var(--surface, #1a1625);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: monospace;
        }
        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}