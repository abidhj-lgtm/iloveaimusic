import "server-only";

export interface ProfileRow {
  id: string;
  legacy_id: string | null;
  email: string;
  name: string;
  handle: string;
  bio: string;
  avatar_palette: number;
  provider: "email" | "google" | "demo";
  role: "user" | "creator" | "moderator" | "admin";
  verified: boolean;
  pass_hash: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string; user_id: string; token_hash: string;
  expires_at: string; revoked_at: string | null;
}

export interface AuthTokenRow {
  id: string; user_id: string; kind: "verify" | "reset";
  token_hash: string; expires_at: string; used_at: string | null;
}

export interface DevMailRow {
  id: string; box_id: string; to_email: string; kind: "verify" | "reset";
  token: string; subject: string; body: string;
  sent_at: string; expires_at: string; used_at: string | null;
}

export interface TrackRow {
  id: string;
  legacy_id: string | null;
  user_id: string;
  title: string;
  source: "upload" | "youtube";
  status: "draft" | "processing" | "published" | "hidden" | "removed" | "failed";
  visibility: "public" | "unlisted" | "private";
  youtube_id: string | null;
  is_live: boolean;
  preset: "synthwave" | "lofi" | "ambient" | null;
  audio_path: string | null;
  audio_mime: string | null;
  audio_bytes: number | null;
  cover_path: string | null;
  cover_seed: string;
  cover_palette: number;
  background: string;
  style_prompt: string;
  lyrics: string;
  instrumental: boolean;
  license?: string;
  ai_tool?: string | null;
  human_contribution?: string | null;
  explicit?: boolean;
  rights_attested?: boolean;
  duration: number | null;
  plays: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at: string | null;
}

export interface CommentRow {
  id: string; track_id: string; user_id: string;
  body: string; created_at: string; deleted_at: string | null;
}

export interface NewProfile {
  email: string; name: string; handle: string; bio?: string;
  avatar_palette?: number; provider?: ProfileRow["provider"];
  verified?: boolean; pass_hash?: string | null;
  legacy_id?: string | null; role?: ProfileRow["role"];
}

export interface NewTrack {
  user_id: string;
  legacy_id?: string | null;
  title: string;
  source: "upload" | "youtube";
  youtube_id?: string | null;
  is_live?: boolean;
  preset?: TrackRow["preset"];
  audio_path?: string | null;
  audio_mime?: string | null;
  audio_bytes?: number | null;
  cover_path?: string | null;
  cover_seed: string;
  cover_palette: number;
  background: string;
  style_prompt: string;
  lyrics: string;
  instrumental: boolean;
  duration?: number | null;
  status?: TrackRow["status"];
  published_at?: string | null;
  plays?: number;
  created_at?: string;
}

export type FeedSort = "new" | "old" | "liked" | "played";
export type FeedView = "all" | "upload" | "youtube" | "saved" | "liked" | "following";

export interface FeedQuery {
  viewerId: string | null;
  sort: FeedSort;
  view: FeedView;
  q: string;
  cursor: string | null;
  limit: number;
}

export interface FeedTrack { track: TrackRow; likedByMe: boolean; savedByMe: boolean; comments: CommentRow[] }

/** No `total` — keyset pagination fetches limit+1 and reports hasMore instead. */
export interface FeedPage { items: FeedTrack[]; nextCursor: string | null; hasMore: boolean }

export interface StoredFile { path: string; mime: string; bytes: number }

export interface Repo {
  getMeta(key: string): Promise<Record<string, unknown> | null>;
  setMeta(key: string, value: Record<string, unknown>): Promise<void>;

  listProfiles(): Promise<ProfileRow[]>;
  profilesByIds(ids: string[]): Promise<ProfileRow[]>;
  findProfileByEmail(email: string): Promise<ProfileRow | null>;
  findProfileById(id: string): Promise<ProfileRow | null>;
  findProfileByLegacy(legacyId: string): Promise<ProfileRow | null>;
  findProfileByHandle(handle: string): Promise<ProfileRow | null>;
  searchProfileIds(q: string, limit: number): Promise<string[]>;
  handleTaken(handle: string): Promise<boolean>;
  createProfile(input: NewProfile): Promise<ProfileRow>;
  updateProfile(id: string, patch: Partial<Pick<ProfileRow, "name" | "bio" | "avatar_palette" | "verified" | "pass_hash" | "provider" | "role">>): Promise<ProfileRow>;

  createSession(userId: string, hash: string, expiresAt: number, ip: string, ua: string): Promise<void>;
  findSession(hash: string): Promise<SessionRow | null>;
  revokeSession(hash: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;

  createAuthToken(userId: string, kind: "verify" | "reset", hash: string, expiresAt: number): Promise<void>;
  findAuthToken(hash: string, kind: "verify" | "reset"): Promise<AuthTokenRow | null>;
  consumeAuthToken(id: string): Promise<void>;
  invalidateAuthTokens(userId: string, kind: "verify" | "reset"): Promise<void>;

  putDevMail(row: Omit<DevMailRow, "id">): Promise<void>;
  listDevMail(boxId: string): Promise<DevMailRow[]>;
  markDevMailUsed(token: string): Promise<void>;
  dropDevMail(boxId: string, kind: "verify" | "reset"): Promise<void>;

  countTracks(): Promise<number>;
  countPublicTracks(): Promise<number>;
  createTrack(input: NewTrack): Promise<TrackRow>;
  findTrackById(id: string): Promise<TrackRow | null>;
  findTrackByLegacy(legacyId: string): Promise<TrackRow | null>;
  findTrackByAudioPath(path: string): Promise<TrackRow | null>;
  tracksByIds(ids: string[]): Promise<TrackRow[]>;
  tracksForUsers(userIds: string[]): Promise<TrackRow[]>;
  listPublicTracks(limit: number): Promise<TrackRow[]>;
  updateTrack(id: string, patch: Partial<TrackRow>): Promise<TrackRow>;
  softDeleteTrack(id: string): Promise<void>;
  restoreTrack(id: string): Promise<void>;
  feed(query: FeedQuery): Promise<FeedPage>;
  tracksByUser(userId: string): Promise<TrackRow[]>;
  incrementPlays(id: string, by: number): Promise<number>;  // returns new count

  // --- admin / account (missing) ---
  adminTracks(q: { status: string; sort: "new" | "old" | "played" | "reported"; q: string; cursor: string | null; limit: number }):
    Promise<{ rows: TrackRow[]; nextCursor: string | null; total: number }>;
  adminUsers(q: { sort: "new" | "old" | "tracks" | "name"; q: string; cursor: string | null; limit: number }):
    Promise<{ rows: ProfileRow[]; nextCursor: string | null; total: number }>;
  allPublicTracks(limit: number): Promise<TrackRow[]>;
  commentsByUser(userId: string): Promise<CommentRow[]>;
  anonymizeProfile(id: string): Promise<void>;

  // --- trust queue (unfiltered) ---
  commentsByIds(ids: string[]): Promise<CommentRow[]>;

  commentsForTracks(trackIds: string[]): Promise<CommentRow[]>;
  addComment(trackId: string, userId: string, body: string): Promise<CommentRow>;
  findComment(id: string): Promise<CommentRow | null>;
  softDeleteComment(id: string): Promise<void>;
  restoreComment(id: string): Promise<void>;

  isLiked(userId: string, trackId: string): Promise<boolean>;
  setLike(userId: string, trackId: string, on: boolean): Promise<number>;
  likedTrackIds(userId: string): Promise<string[]>;
  isSaved(userId: string, trackId: string): Promise<boolean>;
  setSave(userId: string, trackId: string, on: boolean): Promise<void>;
  savedTrackIds(userId: string): Promise<string[]>;
  followingIds(userId: string): Promise<string[]>;
  setFollow(followerId: string, targetId: string, on: boolean): Promise<void>;
  logPlay(trackId: string, userId: string | null, ipHash: string): Promise<void>;

  saveFile(bucket: string, path: string, data: Buffer, mime: string): Promise<StoredFile>;
  readFile(bucket: string, path: string): Promise<{ data: Buffer; mime: string } | null>;
  signedUrl(bucket: string, path: string, ttl: number): Promise<string | null>;

  audit(actorId: string | null, action: string, target: string, meta: Record<string, unknown>, ip: string): Promise<void>;
  createSignedUploadUrl(bucket: string, path: string): Promise<{ signedUrl: string; token: string } | null>;
}

/* ---------- keyset cursor ---------- */

export interface Keyset { k: string | number; i: string }

export function encodeCursor(row: TrackRow, sort: FeedSort): string {
  const k = sort === "liked" ? row.like_count : sort === "played" ? row.plays : row.created_at;
  return Buffer.from(JSON.stringify({ k, i: row.id }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): Keyset | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed?.i !== "string") return null;
    return { k: parsed.k, i: parsed.i };
  } catch { return null; }
}

export function afterCursor(row: TrackRow, sort: FeedSort, c: Keyset): boolean {
  const k = sort === "liked" ? row.like_count : sort === "played" ? row.plays : row.created_at;
  const asc = sort === "old";
  if (k === c.k) return asc ? row.id > c.i : row.id < c.i;
  if (typeof k === "number" && typeof c.k === "number") return asc ? k > c.k : k < c.k;
  return asc ? String(k) > String(c.k) : String(k) < String(c.k);
}