import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { RevisionConflict, publish } from "@/lib/cms/store";
import { validatePage } from "@/lib/cms/validate";
import { readJson } from "@/lib/sanitize";

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const body = (await readJson(req)) as { page?: unknown; rev?: unknown } | null;
  const v = validatePage(body?.page);
  if (!v.ok) return jsonError(v.error);
  try {
    const result = await publish(v.page, typeof body?.rev === "number" ? body.rev : undefined);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RevisionConflict) return jsonError(err.message, 409, { currentRev: err.currentRev });
    return serverError(err, "publish");
  }
}
