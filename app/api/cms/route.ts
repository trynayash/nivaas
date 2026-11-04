import { NextResponse } from "next/server";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { RevisionConflict, getCmsDoc, saveDraft } from "@/lib/cms/store";
import { validatePage } from "@/lib/cms/validate";
import { readJson } from "@/lib/sanitize";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await getCmsDoc(), { headers: NO_STORE });
  } catch (err) {
    return serverError(err, "read CMS");
  }
}

/** Save the draft (autosave from the editor). `rev` is the draft revision the editor last saw. */
export async function PUT(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const body = (await readJson(req)) as { page?: unknown; rev?: unknown } | null;
  const v = validatePage(body?.page);
  if (!v.ok) return jsonError(v.error);
  try {
    return NextResponse.json(await saveDraft(v.page, typeof body?.rev === "number" ? body.rev : undefined));
  } catch (err) {
    if (err instanceof RevisionConflict) return jsonError(err.message, 409, { currentRev: err.currentRev });
    return serverError(err, "save draft");
  }
}
