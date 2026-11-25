import "server-only";
import path from "node:path";

const raw = (k: string) => (process.env[k] ?? "").trim();

export const SITE_URL = (raw("NEXT_PUBLIC_SITE_URL") || raw("VERCEL_URL") || "http://localhost:3000")
  .replace(/^([^h])/, "https://$1")
  .replace(/\/$/, "");

export const IS_PROD = process.env.NODE_ENV === "production";
export const APP_ENV = raw("APP_ENV") || (IS_PROD ? "production" : "development");
export const RELEASE = raw("APP_RELEASE") || raw("VERCEL_GIT_COMMIT_SHA").slice(0, 12) || "dev";

export const SUPABASE_URL = raw("SUPABASE_URL");
export const SUPABASE_KEY = raw("SUPABASE_SERVICE_ROLE_KEY");
export const DB_MODE: "local" | "supabase" = SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

/** Override where the local JSON store lives. Used by the E2E suite. */
export const DATA_DIR = raw("ILISTENAI_DATA_DIR") || path.join(process.cwd(), ".data");

export const RESEND_KEY = raw("RESEND_API_KEY");
export const MAIL_FROM = raw("MAIL_FROM") || "I Love AI Music <no-reply@iloveaimusic.com>";
export const MAIL_MODE: "dev" | "resend" = RESEND_KEY ? "resend" : "dev";

export const GOOGLE_ID = raw("GOOGLE_CLIENT_ID");
export const GOOGLE_SECRET = raw("GOOGLE_CLIENT_SECRET");
export const GOOGLE_ENABLED = !!(GOOGLE_ID && GOOGLE_SECRET);

export const UPSTASH_URL = raw("UPSTASH_REDIS_REST_URL");
export const UPSTASH_TOKEN = raw("UPSTASH_REDIS_REST_TOKEN");
export const RATE_LIMIT_MODE: "upstash" | "in-process" = UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "in-process";

export const STAFF_EMAILS = raw("STAFF_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const BACKUP_TOKEN = raw("BACKUP_TOKEN");

/** Sentry DSN. Without it, errors still log as structured JSON to the console. */
export const SENTRY_DSN = raw("SENTRY_DSN");
export const CLIENT_SENTRY_DSN = raw("NEXT_PUBLIC_SENTRY_DSN") || SENTRY_DSN;

export const SESSION_COOKIE = "ilistenai_session";
export const OAUTH_STATE_COOKIE = "ilistenai_oauth";
export const DEVBOX_COOKIE = "ilistenai_devbox";

export const SESSION_TTL_MS = 30 * 24 * 3600_000;
export const VERIFY_TTL_MS = 24 * 3600_000;
export const RESET_TTL_MS = 60 * 60_000;
export const DEVBOX_TTL_MS = 7 * 24 * 3600_000;

export const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES ?? 50 * 1024 * 1024);
export const MAX_COVER_BYTES = Number(process.env.MAX_COVER_BYTES ?? 8 * 1024 * 1024);
export const FEED_PAGE = Number(process.env.FEED_PAGE ?? 20);

export const AUDIO_BUCKET = process.env.AUDIO_BUCKET ?? "audio-originals";
export const COVER_BUCKET = process.env.COVER_BUCKET ?? "covers";
export const DEMO_EMAIL = "aria@gmail.com";

/** Demo login is a development convenience. Off in production unless explicitly enabled. */
export const DEMO_LOGIN_ENABLED = raw("ALLOW_DEMO_LOGIN")
  ? raw("ALLOW_DEMO_LOGIN").toLowerCase() === "true"
  : !IS_PROD;

export function assertProductionConfig(): void {
  if (IS_PROD && DB_MODE === "local") {
    throw new Error("Production requires a database. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/migrations/*.sql.");
  }
  if (IS_PROD && MAIL_MODE === "dev") {
    throw new Error("Production requires email. Set RESEND_API_KEY and MAIL_FROM.");
  }
}