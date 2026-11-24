import "server-only";
import { SESSION_TTL_MS } from "./env";
import { newToken, tokenHash } from "./crypto";
import { getRepo, toPrivateUser, type ClientUser, type ProfileRow } from "./store";

export async function issueSession(userId: string, ip: string, ua: string) {
  const token = newToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await getRepo().createSession(userId, tokenHash(token), expiresAt, ip, ua);
  return { token, expiresAt };
}

export async function resolveSession(token: string | null): Promise<ProfileRow | null> {
  if (!token) return null;
  const repo = getRepo();
  const session = await repo.findSession(tokenHash(token));
  if (!session || session.revoked_at) return null;
  if (Date.parse(session.expires_at) < Date.now()) return null;
  const profile = await repo.findProfileById(session.user_id);
  if (!profile || profile.deleted_at) return null;
  return profile;
}

export async function currentUser(token: string | null): Promise<ClientUser | null> {
  const row = await resolveSession(token);
  return row ? toPrivateUser(row) : null;
}

export async function destroySession(token: string | null): Promise<void> {
  if (token) await getRepo().revokeSession(tokenHash(token));
}