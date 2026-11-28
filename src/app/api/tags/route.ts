import { NextRequest } from "next/server";
import { ok, serverError } from "@/server/http";
import { getTagCounts } from "@/server/store/features";
import { SEED_GENRES, SEED_MOODS } from "@/lib/genres";

export const dynamic = "force-dynamic";

const GRADUATION_THRESHOLD = 3;
const NEW_BADGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns filterable tags for the search UI.
 *
 * Shape:
 *   {
 *     ok: true,
 *     genres:  [{ id, label, count, isSeed, isNew }],
 *     moods:   [{ id, label, count, isSeed, isNew }],
 *     organic: [{ id, label, count, isSeed: false, isNew }]
 *   }
 *
 * Rules:
 *   - Seed genres/moods with count > 0 are included
 *   - Seed genres/moods with count = 0 are hidden
 *   - Organic tags with count >= 3 are "graduated" and included
 *   - Organic tags with count < 3 are excluded
 *   - Tags graduated within 7 days get isNew: true (for "NEW" badge)
 *   - Organic tags are sorted: new first, then by count, then alphabetically
 */
export async function GET() {
  try {
    const counts = await getTagCounts();
    const countMap = new Map(counts.map((c) => [c.tag, c]));
    const now = Date.now();
    const isNew = (firstSeenAt: number) =>
      firstSeenAt > 0 && (now - firstSeenAt) < NEW_BADGE_WINDOW_MS;

    // Build seed tags with counts (hide empty seeds)
    const seedGenres = SEED_GENRES
      .map((s) => {
        const data = countMap.get(s.id);
        return {
          id: s.id,
          label: s.label,
          count: data?.count ?? 0,
          isSeed: true,
          isNew: false
        };
      })
      .filter((t) => t.count > 0);

    const seedMoods = SEED_MOODS
      .map((s) => {
        const data = countMap.get(s.id);
        return {
          id: s.id,
          label: s.label,
          count: data?.count ?? 0,
          isSeed: true,
          isNew: false
        };
      })
      .filter((t) => t.count > 0);

    // Build graduated organic tags
    const seedIds = new Set([...SEED_GENRES, ...SEED_MOODS].map((s) => s.id));
    const organic = counts
      .filter((c) => !seedIds.has(c.tag) && c.count >= GRADUATION_THRESHOLD)
      .map((c) => ({
        id: c.tag,
        label: capitalize(c.tag),
        count: c.count,
        isSeed: false,
        isNew: isNew(c.firstSeenAt),
        firstSeenAt: c.firstSeenAt
      }))
      .sort((a, b) => {
        // New tags first
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        // Then by count (descending)
        if (b.count !== a.count) return b.count - a.count;
        // Then alphabetically
        return a.label.localeCompare(b.label);
      });

    return ok({ genres: seedGenres, moods: seedMoods, organic });
  } catch (err) {
    return serverError(err, "Could not load tags.");
  }
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}