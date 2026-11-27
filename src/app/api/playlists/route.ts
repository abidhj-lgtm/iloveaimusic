import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { SUPABASE_URL } from "@/server/env";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";
import { createPlaylist, playlistsByUser, publicPlaylists } from "@/server/store/features";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the playlist a name.").max(120),
  description: z.string().trim().max(1000).optional(),
  coverSeed: z.string().max(80).optional(),
  coverPalette: z.number().int().min(0).max(11).optional(),
  isPublic: z.boolean().optional()
});

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "public") {
      const rows = await publicPlaylists(24);
      return ok({ items: rows });
    }
    if (!viewer) return fail("Log in first.", 401, "unauthorized");
    const rows = await playlistsByUser(viewer.id, 100);
    return ok({ items: rows });
  } catch (err) {
    return serverError(err, "Could not load playlists.");
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  if (!SUPABASE_URL) return fail("Playlists need Supabase mode.", 501, "mode");

  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

  const limit = await rateLimit("playlist", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = createSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid playlist.", 400, "validation");

  try {
    const existing = await playlistsByUser(viewer.id, 200);
    if (existing.length >= 50) return fail("You have reached the 50-playlist limit.", 400, "quota");

    const d = parsed.data;
    const row = await createPlaylist({
      user_id: viewer.id,
      title: d.title,
      description: d.description ?? "",
      cover_seed: d.coverSeed ?? "",
      cover_palette: d.coverPalette ?? 0,
      is_public: d.isPublic ?? true
    });
    return ok({ playlist: row });
  } catch (err) {
    return serverError(err, "Could not create the playlist.");
  }
}