import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { isValidPage, publish } from "@/lib/cms/store";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isValidPage(body?.page)) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const { publishedAt } = await publish(body.page);
  revalidatePath("/", "layout");
  return NextResponse.json({ publishedAt });
}
