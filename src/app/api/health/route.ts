import { NextResponse } from "next/server";
import { DB_MODE, MAIL_MODE, GOOGLE_ENABLED, RATE_LIMIT_MODE, UPSTASH_URL, UPSTASH_TOKEN, BACKUP_TOKEN, APP_ENV, RELEASE } from "@/server/env";
import { getRepo } from "@/server/store";
import { observabilityEnabled, reportError } from "@/server/observability";

export const dynamic = "force-dynamic";

async function timedCheck(fn: () => Promise<unknown>) {
  const started = Date.now();
  try { await fn(); return { ok: true, ms: Date.now() - started }; }
  catch (err) { reportError(err, { route: "health" }); return { ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : "error" }; }
}

export async function GET() {
  const db = await timedCheck(() => getRepo().countPublicTracks());

  let redis: { ok: boolean; ms: number; error?: string } | null = null;
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    redis = await timedCheck(async () => {
      const res = await fetch(`${UPSTASH_URL}/ping`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }, cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
    });
  }

  const warnings: string[] = [];
  if (MAIL_MODE === "dev") warnings.push("email in dev mode — verification links are not delivered");
  if (RATE_LIMIT_MODE === "in-process") warnings.push("rate limits reset on cold start — set Upstash");
  if (!BACKUP_TOKEN) warnings.push("backups disabled — set BACKUP_TOKEN");
  if (!observabilityEnabled()) warnings.push("error reporting to Sentry off — set SENTRY_DSN");
  if (!GOOGLE_ENABLED) warnings.push("Google sign-in disabled");

  const healthy = db.ok && (redis?.ok ?? true);

  return NextResponse.json({
    ok: healthy,
    site: "iloveaimusic.com",
    env: APP_ENV,
    release: RELEASE,
    checks: { db: { mode: DB_MODE, ...db }, redis: redis ?? { mode: "in-process", ok: true, ms: 0 } },
    email: MAIL_MODE,
    google: GOOGLE_ENABLED,
    rateLimit: RATE_LIMIT_MODE,
    errorReporting: observabilityEnabled() ? "sentry" : "console",
    backups: BACKUP_TOKEN ? "enabled" : "disabled",
    warnings,
    time: new Date().toISOString()
  }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}