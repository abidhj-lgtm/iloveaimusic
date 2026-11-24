import { NextRequest } from "next/server";
import { importSchema, firstIssue } from "@/server/validation";
import { getRepo, toClientTrack } from "@/server/store";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to import your studio.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

  const ip = clientIp(req);
  const limit = await rateLimit("import", viewer.id);
  if (!limit.ok) return fail(`Import limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = importSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  try {
    const repo = getRepo();
    const created: ReturnType<typeof toClientTrack>[] = [];
    const idMap = new Map<string, string>();

    for (const t of parsed.data.tracks) {
      const row = await repo.createTrack({
        user_id: viewer.id, title: t.title, source: t.source,
        youtube_id: t.youtubeId ?? null, is_live: !!t.live, preset: t.preset ?? null,
        audio_path: t.audioPath ?? null, audio_mime: t.audioMime ?? null, audio_bytes: t.audioBytes ?? null,
        cover_path: t.coverPath ?? null, cover_seed: t.coverSeed, cover_palette: t.coverPalette,
        background: t.background, style_prompt: t.stylePrompt,
        lyrics: t.instrumental ? "" : t.lyrics, instrumental: t.instrumental,
        duration: t.duration ?? null,
        created_at: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
        published_at: t.createdAt ? new Date(t.createdAt).toISOString() : undefined
      });
      if (t.localId) idMap.set(t.localId, row.id);
      created.push(toClientTrack(row, viewer.legacy_id ?? viewer.id, 0, false));
    }

    for (const c of parsed.data.comments) {
      const target = idMap.get(c.trackLocalId);
      if (target) await repo.addComment(target, viewer.id, c.text);
    }

    await repo.audit(viewer.id, "studio.import", viewer.id, { tracks: created.length }, ip);
    return ok({ imported: created.length, tracks: created });
  } catch (err) {
    return serverError(err, "Import failed.");
  }
}