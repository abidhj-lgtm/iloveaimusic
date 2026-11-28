import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError, clientIp } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { getRepo } from "@/server/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");
  const { id } = await params;

  try {
    const viewer = await resolveSession(readSessionToken(req));
    const ip = clientIp(req);
    
    // Server-side rate limit: 1 play per track per 20 seconds (mirrors client throttle)
    const key = viewer ? `${viewer.id}:${id}` : `anon:${ip}:${id}`;
    const limit = await rateLimit("play", key, { max: 1, windowMs: 20_000 });
    if (!limit.ok) return ok({ success: true, throttled: true }); // Silent throttle
    
    const repo = getRepo();
    const track = await repo.findTrackById(id);
    if (!track || track.deleted_at || track.visibility !== "public") {
      return fail("Track not found.", 404, "notfound");
    }

    // Call the RPC function to record play with deduplication
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/record_play`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_track_id: id,
          p_user_id: viewer?.id || null
        }),
        cache: "no-store"
      }
    );

    if (!res.ok) {
      // Fallback: just increment if RPC fails
      await repo.incrementPlays(id, 1);
    }

    return ok({ success: true });
  } catch (err) {
    return serverError(err, "Could not record play.");
  }
}