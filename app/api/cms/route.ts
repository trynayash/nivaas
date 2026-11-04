import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getCmsDoc, isValidPage, saveDraft } from "@/lib/cms/store";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getCmsDoc());
}

/** Save the draft (autosave from the editor). */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isValidPage(body?.page)) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  return NextResponse.json(await saveDraft(body.page));
}
