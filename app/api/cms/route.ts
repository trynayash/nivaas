import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/admin-api";
import { getCmsDoc, isValidPage, saveDraft } from "@/lib/cms/store";

export async function GET(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await getCmsDoc());
}

/** Save the draft (autosave from the editor). */
export async function PUT(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!isValidPage(body?.page)) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  return NextResponse.json(await saveDraft(body.page));
}
