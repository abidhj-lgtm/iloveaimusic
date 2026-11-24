import { NextRequest, NextResponse } from "next/server";
import { bucketFor, type MediaKind } from "@/server/media";
import { getRepo } from "@/server/store";
import { resolveSession } from "@/server/session";
import { readSessionToken } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; path: string[] }> }) {
  const { kind, path } = await params;
  if (kind !== "audio" && kind !== "cover") return new NextResponse("Not found", { status: 404 });
  const rel = (path ?? []).join("/");
  if (!rel || rel.includes("..")) return new NextResponse("Not found", { status: 404 });

  const repo = getRepo();
  const bucket = bucketFor(kind as MediaKind);

  if (kind === "audio") {
    // Direct lookup — no feed scan, so this works at any catalog size.
    const track = await repo.findTrackByAudioPath(rel);
    if (!track) return new NextResponse("Not found", { status: 404 });
    const isPublic = track.status === "published" && track.visibility === "public" && !track.deleted_at;
    if (!isPublic) {
      const viewer = await resolveSession(readSessionToken(req));
      if (!viewer || viewer.id !== track.user_id) return new NextResponse("Not available", { status: 403 });
    }
    const signed = await repo.signedUrl(bucket, rel, 3600);
    if (signed) return NextResponse.redirect(signed, 302);
  } else {
    const signed = await repo.signedUrl(bucket, rel, 86400);
    if (signed) return NextResponse.redirect(signed, 302);
  }

  const file = await repo.readFile(bucket, rel);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const range = req.headers.get("range");
  const total = file.data.byteLength;
  const body = new Uint8Array(file.data);

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
      if (start <= end && start < total) {
        return new NextResponse(body.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": file.mime,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(end - start + 1),
            "Cache-Control": "private, max-age=3600"
          }
        });
      }
    }
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": kind === "cover" ? "public, max-age=86400, immutable" : "private, max-age=3600"
    }
  });
}