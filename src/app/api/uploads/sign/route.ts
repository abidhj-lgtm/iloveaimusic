import { NextRequest } from "next/server";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { fail, ok, readBody, readSessionToken, sameOrigin, clientIp } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUDIO_BUCKET, COVER_BUCKET, MAX_AUDIO_BYTES, MAX_COVER_BYTES } from "@/server/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email first.", 403, "unverified");

  const ip = clientIp(req);
  const limit = await rateLimit("upload", viewer.id);
  if (!limit.ok) return fail(`Slow down. Try again in ${limit.retryAfter}s.`, 429, "rate");

  const body = await readBody<{ kind: string; size: number; fileName: string }>(req);
  if (!body?.kind || !body.size || !body.fileName) return fail("Missing upload details.", 400, "validation");

  const kind = body.kind === "audio" ? "audio" : "cover";
  const max = kind === "audio" ? MAX_AUDIO_BYTES : MAX_COVER_BYTES;
  const bucket = kind === "audio" ? AUDIO_BUCKET : COVER_BUCKET;

  if (body.size > max) return fail(`File is over ${Math.round(max / 1024 / 1024)} MB.`, 400, "validation");
  if (body.size === 0) return fail("File is empty.", 400, "validation");

  // Generate a signed upload URL from Supabase Storage
  const supabaseStorageUrl = `${SUPABASE_URL}/storage/v1`;
  const objectPath = `${viewer.id}/${Date.now()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try {
    const signRes = await fetch(`${supabaseStorageUrl}/object/upload/sign/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!signRes.ok) {
      const err = await signRes.text();
      return fail(`Storage sign failed: ${err}`, 502, "storage");
    }

    const signData = await signRes.json();
    return ok({
      signedUrl: `${supabaseStorageUrl}${signData.url}`,
      token: signData.token,
      path: `${bucket}/${objectPath}`,
      bucket,
      objectPath
    });
  } catch (err) {
    return fail("Could not create upload URL.", 500, "storage");
  }
}