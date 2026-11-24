import "server-only";
import { VERIFY_TTL_MS, RESET_TTL_MS, MAIL_MODE, DB_MODE, GOOGLE_ENABLED, GOOGLE_ID, GOOGLE_SECRET, SITE_URL, OAUTH_STATE_COOKIE, DEMO_LOGIN_ENABLED, IS_PROD } from "./env";
import { hashPassword, verifyPassword, newToken, tokenHash, uuid } from "./crypto";
import { getRepo, toPrivateUser, toPublicProfile, type ClientUser, type PublicProfile, type ProfileRow } from "./store";
import { issueSession, resolveSession, destroySession } from "./session";
import { sendAuthMail, readDevInbox, markDevMailUsed, type DevMail } from "./mail";
import { slugHandle } from "./validation";
import { ensureCatalogSeeded, loadViewerCollections } from "./content-service";
import { roleFor, ensureTrustSeeded, type StaffRole } from "./trust/service";
import { CATALOG_ARTISTS } from "@/lib/catalog";

export interface AuthResult {
  ok: boolean; error?: string; code?: string;
  token?: string; expiresAt?: number; user?: ClientUser;
}

const RESERVED = new Set(CATALOG_ARTISTS.map((a) => a.handle));

async function uniqueHandle(name: string): Promise<string> {
  const repo = getRepo();
  const base = slugHandle(name);
  let candidate = base, n = 2;
  while (RESERVED.has(candidate) || (await repo.handleTaken(candidate))) {
    candidate = `${base}${n++}`.slice(0, 24);
    if (n > 999) { candidate = `artist${uuid().slice(0, 8)}`; break; }
  }
  return candidate;
}

export async function ensureDemoAccount(): Promise<ProfileRow> {
  await ensureCatalogSeeded();
  const repo = getRepo();
  return (await repo.findProfileByLegacy("u-aria"))
    ?? (await repo.findProfileByEmail("aria@gmail.com"))
    ?? repo.createProfile({
      email: "aria@gmail.com", name: "Aria Vale", handle: "ariavale",
      bio: CATALOG_ARTISTS[0].bio, avatar_palette: 0, provider: "demo",
      verified: true, pass_hash: await hashPassword("demo1234"), legacy_id: "u-aria"
    });
}

export interface Bootstrap {
  mode: typeof DB_MODE; mailMode: typeof MAIL_MODE;
  googleEnabled: boolean; demoEnabled: boolean;
  role: StaffRole;
  user: ClientUser | null; profiles: PublicProfile[]; demo: PublicProfile | null;
  devInbox: DevMail[]; liked: string[]; saved: string[]; following: string[];
}

export async function bootstrap(sessionToken: string | null, boxId: string | null): Promise<Bootstrap> {
  const repo = getRepo();
  const demo = await ensureDemoAccount();
  await ensureTrustSeeded();
  const [profiles, sessionRow] = await Promise.all([repo.listProfiles(), resolveSession(sessionToken)]);
  const collections = await loadViewerCollections(sessionRow?.id ?? null);
  return {
    mode: DB_MODE, mailMode: MAIL_MODE, googleEnabled: GOOGLE_ENABLED,
    demoEnabled: DEMO_LOGIN_ENABLED,
    role: await roleFor(sessionRow),
    user: sessionRow ? toPrivateUser(sessionRow) : null,
    profiles: profiles.filter((p) => !p.deleted_at).map(toPublicProfile),
    demo: DEMO_LOGIN_ENABLED ? toPublicProfile(demo) : null,
    devInbox: await readDevInbox(boxId),
    ...collections
  };
}

async function issueAuthToken(user: ProfileRow, kind: "verify" | "reset", boxId: string) {
  const repo = getRepo();
  await repo.invalidateAuthTokens(user.id, kind);
  await repo.dropDevMail(boxId, kind);
  const token = newToken();
  const expiresAt = Date.now() + (kind === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS);
  await repo.createAuthToken(user.id, kind, tokenHash(token), expiresAt);
  await sendAuthMail({ to: user.email, kind, token, expiresAt, name: user.name, boxId });
}

export async function signup(name: string, email: string, password: string, ip: string, boxId: string): Promise<AuthResult> {
  const repo = getRepo();
  if (await repo.findProfileByEmail(email)) return { ok: false, error: "An account with this email already exists.", code: "exists" };
  const user = await repo.createProfile({
    email, name, handle: await uniqueHandle(name), avatar_palette: Math.floor(Math.random() * 6),
    provider: "email", verified: false, pass_hash: await hashPassword(password)
  });
  await issueAuthToken(user, "verify", boxId);
  await repo.audit(user.id, "auth.signup", user.id, {}, ip);
  return { ok: true, user: toPrivateUser(user) };
}

export async function resendVerification(email: string, ip: string, boxId: string): Promise<AuthResult> {
  const repo = getRepo();
  const user = await repo.findProfileByEmail(email);
  if (!user || user.deleted_at) return { ok: false, error: "No account found for this email.", code: "nouser" };
  if (user.verified) return { ok: false, error: "This email is already verified — you can log in.", code: "verified" };
  await issueAuthToken(user, "verify", boxId);
  await repo.audit(user.id, "auth.resend", user.id, {}, ip);
  return { ok: true };
}

export async function verifyEmail(token: string, ip: string): Promise<AuthResult> {
  const repo = getRepo();
  const row = await repo.findAuthToken(tokenHash(token), "verify");
  if (!row || row.used_at) return { ok: false, error: "This verification link is invalid or already used.", code: "invalid" };
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, error: "This link has expired. Request a new one.", code: "expired" };
  const user = await repo.findProfileById(row.user_id);
  if (!user || user.deleted_at) return { ok: false, error: "Account no longer exists.", code: "nouser" };
  await repo.updateProfile(user.id, { verified: true });
  await repo.consumeAuthToken(row.id);
  await markDevMailUsed(token);
  await repo.audit(user.id, "auth.verified", user.id, {}, ip);
  await ensureTrustSeeded();
  return { ok: true, user: toPrivateUser({ ...user, verified: true }) };
}

export async function login(email: string, password: string, ip: string, ua: string): Promise<AuthResult> {
  const repo = getRepo();
  const user = await repo.findProfileByEmail(email);
  if (!user || user.deleted_at) return { ok: false, error: "No account found for this email.", code: "nouser" };
  if (user.provider === "demo" && !DEMO_LOGIN_ENABLED) return { ok: false, error: "The demo account is disabled on this deployment.", code: "demo-off" };
  if (user.provider === "google" && !user.pass_hash) return { ok: false, error: "This account uses Google sign-in. Use the Google button below.", code: "google" };
  if (!user.verified) return { ok: false, error: "Your email isn't verified yet.", code: "unverified" };
  if (!(await verifyPassword(password, user.pass_hash))) {
    await repo.audit(user.id, "auth.login_failed", user.id, {}, ip);
    return { ok: false, error: "Incorrect password. Try again.", code: "pass" };
  }
  const session = await issueSession(user.id, ip, ua);
  await repo.audit(user.id, "auth.login", user.id, {}, ip);
  return { ok: true, ...session, user: toPrivateUser(user) };
}

export async function demoLogin(ip: string, ua: string): Promise<AuthResult> {
  if (!DEMO_LOGIN_ENABLED) return { ok: false, error: "The demo account is disabled on this deployment.", code: "demo-off" };
  const demo = await ensureDemoAccount();
  await ensureTrustSeeded();
  const session = await issueSession(demo.id, ip, ua);
  await getRepo().audit(demo.id, "auth.demo_login", demo.id, {}, ip);
  return { ok: true, ...session, user: toPrivateUser(demo) };
}

export async function logout(token: string | null, ip: string): Promise<AuthResult> {
  const row = await resolveSession(token);
  await destroySession(token);
  if (row) await getRepo().audit(row.id, "auth.logout", row.id, {}, ip);
  return { ok: true };
}

export async function forgotPassword(email: string, ip: string, boxId: string): Promise<AuthResult> {
  const repo = getRepo();
  const user = await repo.findProfileByEmail(email);
  if (user && user.verified && !user.deleted_at) {
    await issueAuthToken(user, "reset", boxId);
    await repo.audit(user.id, "auth.forgot", user.id, {}, ip);
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string, ip: string): Promise<AuthResult> {
  const repo = getRepo();
  const row = await repo.findAuthToken(tokenHash(token), "reset");
  if (!row || row.used_at) return { ok: false, error: "This reset link is invalid or already used.", code: "invalid" };
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, error: "This reset link has expired. Request a new one.", code: "expired" };
  const user = await repo.findProfileById(row.user_id);
  if (!user || user.deleted_at) return { ok: false, error: "Account no longer exists.", code: "nouser" };
  await repo.updateProfile(user.id, { pass_hash: await hashPassword(password), verified: true });
  await repo.consumeAuthToken(row.id);
  await repo.revokeAllSessions(user.id);
  await markDevMailUsed(token);
  await repo.audit(user.id, "auth.password_reset", user.id, {}, ip);
  return { ok: true };
}

export async function updateProfile(sessionToken: string | null, patch: { name?: string; bio?: string; avatarPalette?: number }, ip: string): Promise<AuthResult> {
  const repo = getRepo();
  const row = await resolveSession(sessionToken);
  if (!row) return { ok: false, error: "You need to log in again.", code: "unauthorized" };
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.bio !== undefined) dbPatch.bio = patch.bio;
  if (patch.avatarPalette !== undefined) dbPatch.avatar_palette = patch.avatarPalette;
  const updated = await repo.updateProfile(row.id, dbPatch as never);
  await repo.audit(row.id, "profile.update", row.id, dbPatch, ip);
  return { ok: true, user: toPrivateUser(updated) };
}

export const newOAuthState = () => newToken();
export const OAUTH_COOKIE = OAUTH_STATE_COOKIE;

export function googleAuthUrl(state: string, next: string): string {
  const p = new URLSearchParams({
    client_id: GOOGLE_ID, redirect_uri: `${SITE_URL}/api/auth/google/callback`,
    response_type: "code", scope: "openid email profile", access_type: "online",
    include_granted_scopes: "true", prompt: "select_account",
    state: `${state}.${Buffer.from(next || "/").toString("base64url")}`
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: `${SITE_URL}/api/auth/google/callback`, grant_type: "authorization_code" })
    });
    if (!tr.ok) return null;
    const tj = (await tr.json()) as { access_token?: string };
    if (!tj.access_token) return null;
    const ir = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tj.access_token}` } });
    if (!ir.ok) return null;
    const info = (await ir.json()) as { email?: string; name?: string; email_verified?: boolean };
    if (!info.email) return null;
    return { email: info.email.toLowerCase(), name: (info.name || info.email.split("@")[0]).slice(0, 40), verified: info.email_verified !== false };
  } catch { return null; }
}

export async function loginWithGoogleProfile(profile: { email: string; name: string; verified: boolean }, ip: string, ua: string): Promise<AuthResult> {
  const repo = getRepo();
  let user = await repo.findProfileByEmail(profile.email);
  if (user?.deleted_at) return { ok: false, error: "This account has been closed.", code: "closed" };
  if (user) {
    if (!user.verified && profile.verified) user = await repo.updateProfile(user.id, { verified: true });
  } else {
    user = await repo.createProfile({
      email: profile.email, name: profile.name, handle: await uniqueHandle(profile.name),
      avatar_palette: Math.floor(Math.random() * 6), provider: "google", verified: profile.verified, pass_hash: null
    });
  }
  const session = await issueSession(user.id, ip, ua);
  await repo.audit(user.id, "auth.google_login", user.id, {}, ip);
  await ensureTrustSeeded();
  return { ok: true, ...session, user: toPrivateUser(user) };
}

export const DEMO_DISABLED_IN_PROD = IS_PROD && !DEMO_LOGIN_ENABLED;