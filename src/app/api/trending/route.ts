import { NextRequest } from "next/server";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, serverError } from "@/server/http";
import { resolveSession } from "@/server/session";
import { getRepo } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");
  
  try {
    const viewer = await resolveSession(req.headers.get("cookie") ?? "");
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));
    
    // Call the SQL function
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_trending_tracks`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_limit: limit }),
        cache: "no-store"
      }
    );
    
    if (!res.ok) throw new Error(`Failed to fetch trending: ${res.status}`);
    
    const rows = await res.json();
    const repo = getRepo();
    
    // Decorate with viewer-specific data
    const trackIds = rows.map((r: any) => r.track_id);
    const decorated = await Promise.all(
      trackIds.map(async (id: string) => {
        const track = await repo.findTrackById(id);
        if (!track) return null;
        
        const liked = viewer ? await repo.isLikedBy(viewer.id, id) : false;
        const saved = viewer ? await repo.isSavedBy(viewer.id, id) : false;
        
        return {
          track: {
            id: track.id,
            title: track.title,
            userId: track.user_id,
            plays: track.plays,
            createdAt: Date.parse(track.created_at),
            coverSeed: track.cover_seed,
            coverPalette: track.cover_palette,
            source: track.source,
            youtubeId: track.youtube_id,
            background: track.background,
            stylePrompt: track.style_prompt,
            duration: track.duration
          },
          likedByMe: liked,
          savedByMe: saved
        };
      })
    );
    
    return ok({ items: decorated.filter(Boolean) });
  } catch (err) {
    return serverError(err, "Could not load trending tracks.");
  }
}