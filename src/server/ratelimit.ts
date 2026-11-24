import "server-only";
import { UPSTASH_URL, UPSTASH_TOKEN } from "./env";

const memory = new Map<string, number[]>();

export interface LimitResult { ok: boolean; retryAfter: number; remaining: number }

export const LIMITS = {
  signup: { max: 5, windowMs: 15 * 60_000 },
  login: { max: 12, windowMs: 15 * 60_000 },
  resend: { max: 3, windowMs: 10 * 60_000 },
  forgot: { max: 4, windowMs: 15 * 60_000 },
  reset: { max: 6, windowMs: 15 * 60_000 },
  demo: { max: 30, windowMs: 15 * 60_000 },
  profile: { max: 40, windowMs: 5 * 60_000 },
  verify: { max: 20, windowMs: 15 * 60_000 },
  publish: { max: 20, windowMs: 15 * 60_000 },
  upload: { max: 60, windowMs: 15 * 60_000 },
  comment: { max: 40, windowMs: 10 * 60_000 },
  react: { max: 300, windowMs: 5 * 60_000 },
  play: { max: 400, windowMs: 10 * 60_000 },
  import: { max: 4, windowMs: 30 * 60_000 }
} as const;

export type LimitName = keyof typeof LIMITS;

function localLimit(key: string, max: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    memory.set(key, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)), remaining: 0 };
  }
  hits.push(now);
  memory.set(key, hits);
  if (memory.size > 8000) for (const [k, v] of memory) if (!v.length) memory.delete(k);
  return { ok: true, retryAfter: 0, remaining: max - hits.length };
}

async function upstashLimit(key: string, max: number, windowMs: number): Promise<LimitResult> {
  const redisKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", redisKey], ["PEXPIRE", redisKey, String(windowMs)]]),
      cache: "no-store"
    });
    if (!res.ok) throw new Error("upstash");
    const json = (await res.json()) as [{ result: number }];
    const count = Number(json?.[0]?.result ?? 1);
    return count > max
      ? { ok: false, retryAfter: Math.ceil(windowMs / 1000), remaining: 0 }
      : { ok: true, retryAfter: 0, remaining: Math.max(0, max - count) };
  } catch {
    return localLimit(key, max, windowMs);
  }
}

export async function rateLimit(name: LimitName, identity: string): Promise<LimitResult> {
  const { max, windowMs } = LIMITS[name];
  const key = `${name}:${identity}`;
  return UPSTASH_URL && UPSTASH_TOKEN ? upstashLimit(key, max, windowMs) : localLimit(key, max, windowMs);
}