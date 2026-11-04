import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin, serverError } from "@/lib/admin-api";
import { writableListingStore } from "@/lib/listings/store";

/** Delete every sample listing (keeps real ones). Samples are never re-seeded afterwards. */
export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    const removed = await writableListingStore().removeSamples();
    revalidatePath("/", "layout");
    return NextResponse.json({ removed });
  } catch (err) {
    return serverError(err, "remove samples");
  }
}
