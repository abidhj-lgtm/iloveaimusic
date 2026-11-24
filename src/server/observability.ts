import "server-only";
import { randomUUID } from "node:crypto";
import { SENTRY_DSN, APP_ENV, RELEASE, SITE_URL } from "./env";

export type Level = "debug" | "info" | "warn" | "error";

export interface LogCtx {
  requestId?: string;
  route?: string;
  userId?: string | null;
  ip?: string;
  [k: string]: unknown;
}

export const newRequestId = () => randomUUID().slice(0, 8);

const REDACT = /pass|token|secret|authorization|apikey|cookie/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 3 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  return value;
}

export function log(level: Level, message: string, ctx: LogCtx = {}): void {
  const entry = { ts: new Date().toISOString(), level, message, env: APP_ENV, release: RELEASE, ...scrub(ctx) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

interface SentryTarget { url: string; key: string }

function parseDsn(dsn: string): SentryTarget | null {
  try {
    const u = new URL(dsn);
    const key = u.username;
    const project = u.pathname.replace(/^\//, "");
    if (!key || !project) return null;
    return { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, key };
  } catch { return null; }
}

const target = SENTRY_DSN ? parseDsn(SENTRY_DSN) : null;

function frames(stack?: string) {
  if (!stack) return [];
  return stack.split("\n").slice(1, 12).map((line) => {
    const m = /\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?/.exec(line);
    return m
      ? { function: m[1] || "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) }
      : { function: line.trim() };
  }).reverse();
}

/** Fire-and-forget. Never blocks or breaks a request. */
export function reportError(err: unknown, ctx: LogCtx = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  log("error", e.message, { ...ctx, stack: e.stack?.split("\n").slice(0, 4).join(" | ") });
  if (!target) return;

  const eventId = randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const event = {
    event_id: eventId,
    timestamp: now,
    platform: "node",
    level: "error",
    environment: APP_ENV,
    release: RELEASE,
    server_name: SITE_URL.replace(/^https?:\/\//, ""),
    exception: { values: [{ type: e.name || "Error", value: e.message, stacktrace: { frames: frames(e.stack) } }] },
    tags: { route: String(ctx.route ?? "unknown"), runtime: "nodejs" },
    extra: scrub(ctx) as Record<string, unknown>
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: now, dsn: SENTRY_DSN }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n");

  void fetch(`${target.url}?sentry_key=${encodeURIComponent(target.key)}&sentry_version=7`, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
    signal: AbortSignal.timeout(4000)
  }).catch(() => undefined);
}

export async function timed<T>(label: string, fn: () => Promise<T>, ctx: LogCtx = {}): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    const ms = Date.now() - started;
    if (ms > 1500) log("warn", `slow:${label}`, { ...ctx, ms });
    return out;
  } catch (err) {
    reportError(err, { ...ctx, label });
    throw err;
  }
}

export const observabilityEnabled = () => !!target;