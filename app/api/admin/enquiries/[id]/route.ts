import { NextResponse } from "next/server";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { ENQUIRY_STATUSES, enquiryStore, type EnquiryStatus } from "@/lib/enquiries/store";
import { ID_RE, readJson } from "@/lib/sanitize";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return jsonError("Enquiry not found.", 404);
  const body = (await readJson(req)) as { status?: string; note?: string } | null;
  const status = body?.status as EnquiryStatus | undefined;
  if (status && !ENQUIRY_STATUSES.includes(status)) return jsonError("Unknown status.");
  if (body?.note !== undefined && (typeof body.note !== "string" || body.note.length > 2000)) return jsonError("Note is too long.");
  if (!status && body?.note === undefined) return jsonError("Nothing to change.");
  try {
    const e = await enquiryStore().update(id, { status, note: body?.note });
    if (!e) return jsonError("Enquiry not found.", 404);
    return NextResponse.json({ enquiry: e });
  } catch (err) {
    return serverError(err, "update enquiry");
  }
}
