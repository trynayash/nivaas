import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin } from "@/lib/admin-api";
import { isValidPage, publish } from "@/lib/cms/store";

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!isValidPage(body?.page)) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const { publishedAt } = await publish(body.page);
  revalidatePath("/", "layout");
  return NextResponse.json({ publishedAt });
}
