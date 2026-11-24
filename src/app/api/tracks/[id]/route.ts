import { NextRequest } from "next/server";
import { getTrackBundle, assertTrackOwner } from "@/server/content-service";
import { trackPatchSchema, firstIssue } from "@/server/validation";
import { getRepo, toClientTrack } from "@/server/store";
import { resolveSession } from "@/server/session";
import { clientIp, fail, json, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const viewer = await resolveSession(readSessionToken(req));
    const bundle = await getTrackBundle(id, viewer?.id ?? null);
    return bundle ? ok(bundle) : fail("Track not found.", 404, "notfound");
  } catch (err) {
    return serverError(err, "Could not load the track.");
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;
  const viewer = await resolveSession(readSessionToken(req));
  const owned = await assertTrackOwner(id, viewer?.id ?? null);
  if ("error" in owned) return fail(owned.error, owned.status, "forbidden");

  const parsed = trackPatchSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");

  const p = parsed.data;
  const patch: Record<string, unknown> = {};
  if (p.title !== undefined) patch.title = p.title;
  if (p.source !== undefined) patch.source = p.source;
  if (p.youtubeId !== undefined) patch.youtube_id = p.youtubeId ?? null;
  if (p.live !== undefined) patch.is_live = p.live;
  if (p.preset !== undefined) patch.preset = p.preset ?? null;
  if (p.audioPath !== undefined) patch.audio_path = p.audioPath ?? null;
  if (p.audioMime !== undefined) patch.audio_mime = p.audioMime ?? null;
  if (p.audioBytes !== undefined) patch.audio_bytes = p.audioBytes ?? null;
  if (p.coverPath !== undefined) patch.cover_path = p.coverPath ?? null;
  if (p.coverSeed !== undefined) patch.cover_seed = p.coverSeed;
  if (p.coverPalette !== undefined) patch.cover_palette = p.coverPalette;
  if (p.background !== undefined) patch.background = p.background;
  if (p.stylePrompt !== undefined) patch.style_prompt = p.stylePrompt;
  if (p.instrumental !== undefined) { patch.instrumental = p.instrumental; if (p.instrumental) patch.lyrics = ""; }
  if (p.lyrics !== undefined && !p.instrumental) patch.lyrics = p.lyrics;
  if (p.duration !== undefined) patch.duration = p.duration ?? null;

  try {
    const repo = getRepo();
    const row = await repo.updateTrack(owned.realId, patch as never);
    await repo.audit(viewer!.id, "track.update", row.id, Object.keys(patch), clientIp(req));
    const profiles = await repo.listProfiles();
    const owner = profiles.find((x) => x.id === row.user_id);
    const liked = await repo.isLiked(viewer!.id, row.id);
    return ok({ track: toClientTrack(row, owner?.legacy_id ?? row.user_id, row.like_count, liked) });
  } catch (err) {
    return serverError(err, "Could not update the track.");
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;
  const viewer = await resolveSession(readSessionToken(req));
  const owned = await assertTrackOwner(id, viewer?.id ?? null);
  if ("error" in owned) return fail(owned.error, owned.status, "forbidden");
  try {
    const repo = getRepo();
    await repo.softDeleteTrack(owned.realId);
    await repo.audit(viewer!.id, "track.delete", owned.realId, { title: owned.row.title }, clientIp(req));
    return ok({ restorable: true });
  } catch (err) {
    return serverError(err, "Could not delete the track.");
  }
}