import { NextRequest } from "next/server";
import { storeUpload, type MediaKind } from "@/server/media";
import { resolveSession } from "@/server/session";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in to upload.", 401, "unauthorized");
  if (!viewer.verified) return fail("Verify your email before uploading.", 403, "unverified");

  const ip = clientIp(req);
  const limit = await rateLimit("upload", `${viewer.id}:${ip}`);
  if (!limit.ok) return fail(`Upload limit reached. Try again in ${limit.retryAfter}s.`, 429, "rate");

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Expected a file upload.", 400, "validation"); }

  const kind = String(form.get("kind") ?? "") as MediaKind;
  if (kind !== "audio" && kind !== "cover") return fail("Unknown upload kind.", 400, "validation");
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file was attached.", 400, "validation");

  try {
    const res = await storeUpload(kind, file);
    if (!res.ok) return fail(res.error, 400, "media");
    await getAudit(viewer.id, kind, res.path, res.bytes, ip);
    return ok({ path: res.path, mime: res.mime, bytes: res.bytes, kind });
  } catch (err) {
    return serverError(err, "Upload failed.");
  }
}

async function getAudit(userId: string, kind: string, path: string, bytes: number, ip: string) {
  const { getRepo } = await import("@/server/store");
  await getRepo().audit(userId, "media.upload", path, { kind, bytes }, ip);
}