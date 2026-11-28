import { NextRequest } from "next/server";
import { resolveSession } from "@/server/session";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, readSessionToken, serverError } from "@/server/http";
import { getRepo } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20));
  const cursor = req.nextUrl.searchParams.get("cursor"); // ISO timestamp string

  try {
    const repo = getRepo();
    const filters: Record<string, string> = {
      user_id: `eq.${viewer.id}`,
      order: "created_at.desc",
      limit: String(limit + 1) // fetch one extra to detect hasMore
    };

    if (cursor) {
      filters["created_at"] = `lt.${cursor}`;
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?${new URLSearchParams(filters).toString()}`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`
        },
        cache: "no-store"
      }
    );

    if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
    const rows = await res.json();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && page.length > 0
      ? page[page.length - 1].created_at
      : null;

    return ok({ items: page, nextCursor, hasMore });
  } catch (err) {
    return serverError(err, "Could not load notifications.");
  }
}