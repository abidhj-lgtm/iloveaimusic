import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { fail, ok, readBody, readSessionToken, sameOrigin, clientIp } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { z } from "zod";

const signSchema = z.object({
  kind: z.enum(["audio", "cover"]),
  size: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().optional()
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

  const ip = clientIp(req);
  const limit = await rateLimit("upload", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const parsed = signSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail("Invalid upload details.", 400, "validation");

  const { kind, size, fileName, mimeType } = parsed.data;

  // Size limits (50 MB for free Supabase tier)
  const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
  const MAX_COVER_BYTES = 8 * 1024 * 1024;
  const max = kind === "audio" ? MAX_AUDIO_BYTES : MAX_COVER_BYTES;

  if (size > max) {
    return fail(`File too large. Maximum is ${Math.round(max / 1024 / 1024)} MB.`, 400, "validation");
  }

  // Allowed MIME types
  const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/ogg", "audio/m4a", "audio/mp4"];
  const allowedCover = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (mimeType) {
    if (kind === "audio" && !allowedAudio.includes(mimeType)) {
      return fail("Audio format not supported. Use MP3, WAV, FLAC, OGG, or M4A.", 400, "validation");
    }
    if (kind === "cover" && !allowedCover.includes(mimeType)) {
      return fail("Image format not supported. Use JPG, PNG, WebP, or GIF.", 400, "validation");
    }
  }

  // Generate a unique path
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const objectPath = `${viewer.id}/${timestamp}-${sanitized}`;
  const bucket = kind === "audio" ? "audio-originals" : "covers";

  // Create the signed URL using Supabase Storage
  const supabase = getRepo().supabase;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    console.error("Failed to create signed URL:", error);
    return fail("Could not create upload URL. Please try again.", 502, "storage");
  }

  return ok({
    signedUrl: data.signedUrl,
    token: data.token,
    path: `${bucket}/${objectPath}`,
    bucket,
    objectPath,
    expiresIn: 3600 // 1 hour
  });
}