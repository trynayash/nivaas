import "server-only";
import path from "node:path";

export const UPLOAD_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type UploadMode = "blob" | "local" | "none";

/** Blob in production (BLOB_READ_WRITE_TOKEN), the local disk in development, none on Vercel without Blob. */
export function uploadMode(): UploadMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) return "none";
  return "local";
}

/** Detect the real image type from the first bytes (don't trust the browser-provided MIME type). */
export function sniffImage(buf: Uint8Array): { ext: string; type: (typeof IMAGE_TYPES)[number] } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", type: "image/png" };
  const ascii = (a: number, b: number) => String.fromCharCode(...buf.slice(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export const SAFE_NAME = /^[A-Za-z0-9_-]{6,40}\.(jpg|png|webp)$/;
