import "server-only";
import { MAX_AUDIO_BYTES, MAX_COVER_BYTES, AUDIO_BUCKET, COVER_BUCKET } from "./env";
import { uuid } from "./crypto";
import { getRepo } from "./store";

export type MediaKind = "audio" | "cover";

const AUDIO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/ogg": "ogg", "audio/flac": "flac", "audio/mp4": "m4a", "audio/aac": "aac", "audio/webm": "webm"
};
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif"
};

/** Magic-byte sniffing — never trust the declared MIME type. */
export function sniffMime(b: Buffer): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => b.subarray(i, i + s.length).toString("ascii") === s;
  if (b.length < 12) return null;
  if (ascii(0, "ID3") || at(0, 0xff, 0xfb) || at(0, 0xff, 0xf3) || at(0, 0xff, 0xf2) || at(0, 0xff, 0xfa)) return "audio/mpeg";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(0, "fLaC")) return "audio/flac";
  if (ascii(4, "ftyp")) return b.subarray(8, 12).toString("ascii").startsWith("M4A") ? "audio/mp4" : "audio/mp4";
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "audio/webm";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (ascii(0, "GIF8")) return "image/gif";
  return null;
}

export type UploadResult = { ok: true; path: string; mime: string; bytes: number } | { ok: false; error: string };

export async function storeUpload(kind: MediaKind, file: File): Promise<UploadResult> {
  const cap = kind === "audio" ? MAX_AUDIO_BYTES : MAX_COVER_BYTES;
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > cap) return { ok: false, error: `File is over ${Math.round(cap / 1024 / 1024)}MB.` };

  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(data);
  if (!mime) return { ok: false, error: "That file isn't a recognised audio or image format." };

  if (kind === "audio") {
    if (!mime.startsWith("audio/")) return { ok: false, error: "That file isn't audio. MP3, WAV, M4A, OGG or FLAC please." };
    const ext = AUDIO_EXT[mime] ?? "mp3";
    const saved = await getRepo().saveFile(AUDIO_BUCKET, `${uuid()}.${ext}`, data, mime);
    return { ok: true, ...saved };
  }
  if (!mime.startsWith("image/")) return { ok: false, error: "Thumbnails must be an image." };
  const ext = IMAGE_EXT[mime] ?? "jpg";
  const saved = await getRepo().saveFile(COVER_BUCKET, `${uuid()}.${ext}`, data, mime);
  return { ok: true, ...saved };
}

export const bucketFor = (kind: MediaKind) => (kind === "audio" ? AUDIO_BUCKET : COVER_BUCKET);