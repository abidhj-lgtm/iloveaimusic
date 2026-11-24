import "server-only";
import { randomBytes, scrypt, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (p: string | Buffer, s: string | Buffer, n: number) => Promise<Buffer>;
const N = 16384;

export const uuid = () => randomUUID();

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${N}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  if (!Number.isFinite(cost) || cost < 1024) return false;
  try {
    const derived = await scryptAsync(password.normalize("NFKC"), parts[2], 64);
    const expected = Buffer.from(parts[3], "hex");
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function ipHash(ip: string): string {
  return createHash("sha256").update(`ilistenai:${ip}`).digest("hex").slice(0, 32);
}