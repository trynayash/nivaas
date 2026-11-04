import fs from "node:fs/promises";
import path from "node:path";
import { SAFE_NAME, UPLOAD_DIR } from "@/lib/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves locally uploaded photos (development). File names are random and validated. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!SAFE_NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name));
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": TYPES[name.split(".").pop()!],
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
