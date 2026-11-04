import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { newId } from "@/lib/db";
import { MAX_UPLOAD_BYTES, UPLOAD_DIR, sniffImage, uploadMode } from "@/lib/uploads";

/** Local development only: save the photo under data/uploads and serve it from /api/uploads/<name>. */
export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  if (uploadMode() !== "local") return jsonError("Local uploads are disabled here.", 403);
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file received.");
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("That photo is over 15 MB.", 413);
    const buf = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) return jsonError("Only JPG, PNG or WebP photos can be uploaded.", 415);
    const name = `${newId("p")}.${kind.ext}`;
    await fs.mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name), buf);
    return NextResponse.json({ url: `/api/uploads/${name}` }, { status: 201 });
  } catch (err) {
    return serverError(err, "local upload");
  }
}
