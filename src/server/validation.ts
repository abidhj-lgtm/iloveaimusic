import "server-only";
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().min(5).max(160).email("Enter a valid email address.");
export const passwordSchema = z.string().min(8, "Password needs at least 8 characters.").max(200);
export const nameSchema = z.string().trim().min(2, "Artist name needs at least 2 characters.").max(40);

export const signupSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(200) });
export const emailOnlySchema = z.object({ email: emailSchema });
export const tokenSchema = z.object({ token: z.string().trim().min(10).max(200) });
export const resetSchema = z.object({ token: z.string().trim().min(10).max(200), password: passwordSchema });

export const profileSchema = z.object({
  name: nameSchema.optional(),
  bio: z.string().trim().max(200).optional(),
  avatarPalette: z.number().int().min(0).max(15).optional()
}).refine((v) => Object.keys(v).length > 0, "Nothing to update.");

const youtubeId = z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/, "That YouTube id doesn't look right.");
const storagePath = z.string().trim().max(200).regex(/^[a-zA-Z0-9._/-]+$/, "Invalid media path.");

/**
 * Base object. Keep this un-refined so it can be .partial()/.omit()/.extend()'d.
 * Refinements wrap the schema in ZodEffects, which loses those methods.
 */
const trackBase = z.object({
  title: z.string().trim().min(1, "Every track needs a name.").max(120),
  source: z.enum(["upload", "youtube"]),
  youtubeId: youtubeId.optional(),
  live: z.boolean().optional(),
  preset: z.enum(["synthwave", "lofi", "ambient"]).optional(),
  audioPath: storagePath.optional(),
  audioMime: z.string().trim().max(80).optional(),
  audioBytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
  coverPath: storagePath.optional(),
  coverSeed: z.string().trim().min(1).max(80),
  coverPalette: z.number().int().min(0).max(15),
  background: z.string().trim().max(1200).default(""),
  stylePrompt: z.string().trim().max(600).default(""),
  lyrics: z.string().trim().max(5000).default(""),
  instrumental: z.boolean().default(false),
  duration: z.number().min(0).max(24 * 3600).optional(),
  rightsAttested: z.literal(true, { errorMap: () => ({ message: "You must confirm you have the rights to this music." }) })
});

type TrackShape = z.infer<typeof trackBase>;

function refineSource(v: TrackShape, ctx: z.RefinementCtx) {
  if (v.source === "youtube" && !v.youtubeId) {
    ctx.addIssue({ code: "custom", path: ["youtubeId"], message: "A YouTube track needs a video id." });
  }
  if (v.source === "upload" && !v.audioPath && !v.preset) {
    ctx.addIssue({ code: "custom", path: ["audioPath"], message: "An upload needs audio or a synth preset." });
  }
}

/** Create: full object + source rules. */
export const trackSchema = trackBase.superRefine(refineSource);

/** Edit: every field optional, attestation not re-sent. */
export const trackPatchSchema = trackBase.omit({ rightsAttested: true }).partial();

/* ---------------- expressive comments ---------------- */

export const COMMENT_MAX = 1000;

/** Count what a human sees: 😂 = 1, 👨‍👩‍👧‍👦 = 1, ᕕ( ᐛ )ᕗ = 9. */
export function graphemeCount(s: string): number {
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) return [...new Seg("en", { granularity: "grapheme" }).segment(s)].length;
  } catch { /* older runtime */ }
  return [...s].length;
}

/**
 * Deliberately permissive. Keeps every script, emoji, ZWJ sequence,
 * variation selector, skin-tone modifier, kaomoji and newline.
 * Strips only control characters that break rendering.
 */
export function cleanCommentText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export const commentSchema = z
  .object({ text: z.string().max(20000) })
  .transform((v) => ({ text: cleanCommentText(v.text) }))
  .refine((v) => v.text.length > 0, "Say something.")
  .refine((v) => graphemeCount(v.text) <= COMMENT_MAX, `Comments cap at ${COMMENT_MAX} characters.`);
export const toggleSchema = z.object({ on: z.boolean() });

export const feedQuerySchema = z.object({
  sort: z.enum(["new", "old", "liked", "played"]).default("new"),
  view: z.enum(["all", "upload", "youtube", "saved", "liked", "following"]).default("all"),
  q: z.string().trim().max(120).default(""),
  cursor: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  genre: z.string().trim().max(40).optional(),
  mood: z.string().trim().max(40).optional()
});

export const importSchema = z.object({
  tracks: z.array(
    trackBase
      .extend({ localId: z.string().max(80).optional(), createdAt: z.number().optional() })
      .superRefine(refineSource)
  ).max(100),
  comments: z.array(z.object({
    trackLocalId: z.string().max(80),
    text: z.string().max(20000).transform(cleanCommentText),
    createdAt: z.number().optional()
  })).max(500).default([])
});

export const reportSchema = z.object({
  trackId: z.string().trim().max(80).optional(),
  commentId: z.string().trim().max(80).optional(),
  reason: z.enum(["copyright", "spam", "hate", "explicit_mislabel", "broken_media", "impersonation", "other"]),
  details: z.string().trim().min(12, "Give moderators at least a sentence to work with.").max(1000)
}).refine((v) => !!v.trackId || !!v.commentId, "Nothing to report.");

export const rightsSchema = z.object({
  attested: z.literal(true, { errorMap: () => ({ message: "Confirm you hold the rights before saving." }) }),
  license: z.enum(["all_rights_reserved", "cc_by", "cc_by_sa", "cc_by_nc", "cc0", "commercial_ok"]),
  aiTool: z.enum(["unspecified", "suno", "udio", "stable_audio", "musicgen", "riffusion", "aiva", "custom", "browser_synth", "none"]),
  humanContribution: z.string().trim().max(300).default(""),
  explicit: z.boolean().default(false),
  thirdPartySamples: z.boolean().default(false),
  monetizable: z.boolean().default(false),
  distributionOk: z.boolean().default(true)
});

export const moderationSchema = z.object({
  action: z.enum(["hide", "remove", "restore", "dismiss", "review", "strike", "undo"]),
  reportIds: z.array(z.string().max(80)).max(100).default([]),
  trackIds: z.array(z.string().max(80)).max(100).default([]),
  commentIds: z.array(z.string().max(80)).max(100).default([]),
  strikeUserId: z.string().max(80).optional(),
  note: z.string().trim().max(500).default(""),
  batchId: z.string().max(80).optional()
});

export const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? "Invalid input.";

export function slugHandle(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20);
  return (base.length >= 2 ? base : `artist${base}`).slice(0, 24);
}