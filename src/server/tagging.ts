import "server-only";
import { ALL_SEEDS } from "@/lib/genres";
import { addTagsWithSource, deleteTagsBySource, tagsForTracks } from "./store/features";
import { reportError } from "./observability";

/**
 * Normalize text for keyword matching:
 * - Lowercase
 * - Strip diacritics (café → cafe)
 * - Replace non-alphanumeric with spaces
 * - Collapse whitespace
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a keyword matches in normalized text.
 * Multi-word phrases use simple includes.
 * Single words use word-boundary regex.
 */
function keywordMatches(keyword: string, normalizedText: string): boolean {
  const kw = normalize(keyword);
  if (!kw) return false;

  if (kw.includes(" ")) {
    return normalizedText.includes(kw);
  }

  try {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`);
    return re.test(normalizedText);
  } catch {
    return normalizedText.includes(kw);
  }
}

/**
 * Extract matching seed IDs from text.
 * Pure function — no side effects.
 */
export function extractTagsFromText(text: string): string[] {
  if (!text || !text.trim()) return [];
  const normalized = normalize(text);
  if (!normalized) return [];

  const matches = new Set<string>();
  for (const seed of ALL_SEEDS) {
    for (const keyword of seed.keywords) {
      if (keywordMatches(keyword, normalized)) {
        matches.add(seed.id);
        break; // one match per seed is enough
      }
    }
  }
  return [...matches];
}

/**
 * Auto-tag a track based on its prompt and background.
 * Additive only: never deletes existing tags.
 * If a tag already exists (from any source), it's skipped.
 *
 * Returns the list of newly added tags.
 */
export async function autoTagTrack(
  trackId: string,
  prompt: string,
  background?: string
): Promise<string[]> {
  const combined = `${prompt || ""} ${background || ""}`.trim();
  if (!combined) return [];

  const suggestedTags = extractTagsFromText(combined);
  if (suggestedTags.length === 0) return [];

  try {
    // Get existing tags for this track
    const existing = await tagsForTracks([trackId]);
    const existingSet = new Set(existing.map((t) => t.tag));

    // Filter out tags that already exist
    const newTags = suggestedTags.filter((t) => !existingSet.has(t));
    if (newTags.length === 0) return [];

    // Add new tags with source='auto'
    await addTagsWithSource(trackId, newTags, "auto");

    return newTags;
  } catch (err) {
    // Auto-tagging should never break track creation
    reportError(err, { route: "tagging:autoTagTrack", trackId });
    return [];
  }
}

/**
 * Re-run auto-tagging on a track (for updates).
 * Deletes old auto-tags first, then adds new ones.
 * Manual tags are never touched.
 *
 * Returns the list of newly added tags.
 */
export async function reAutoTagTrack(
  trackId: string,
  prompt: string,
  background?: string
): Promise<string[]> {
  try {
    // Delete old auto-tags
    await deleteTagsBySource(trackId, "auto");

    // Re-run auto-tagger
    return await autoTagTrack(trackId, prompt, background);
  } catch (err) {
    reportError(err, { route: "tagging:reAutoTagTrack", trackId });
    return [];
  }
}