import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, uploadMode } from "@/lib/uploads";

/** Which upload path the browser should use. */
export async function GET(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ mode: uploadMode() });
}

/**
 * Vercel Blob client uploads. The browser asks for a short-lived token (admin only), then sends the
 * file straight to Blob storage, so large photos never pass through a serverless function.
 * Blob later calls back with "blob.upload-completed"; that request is verified by handleUpload's signature check.
 */
export async function POST(req: Request) {
  if (uploadMode() !== "blob") return jsonError("Photo storage is not configured.", 503);
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return jsonError("Bad request.");
  if (body.type === "blob.generate-client-token") {
    const denied = await guardAdmin(req);
    if (denied) return denied;
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^listings\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(pathname)) throw new Error("Invalid upload path");
        return { allowedContentTypes: [...IMAGE_TYPES], maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {
        // The listing stores the URL when the form is saved; nothing to do here.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err, "blob upload");
  }
}
