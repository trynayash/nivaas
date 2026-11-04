import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { newId } from "@/lib/db";
import { readJson } from "@/lib/sanitize";
import { toProperty, validateListing } from "@/lib/listings/input";
import { SlugTakenError, writableListingStore } from "@/lib/listings/store";

/** Create a listing. */
export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const body = await readJson(req);
  const v = validateListing(body ?? {});
  if (!v.ok) return jsonError("Some fields need attention.", 422, { fields: v.errors });
  try {
    const saved = await writableListingStore().save(toProperty(v.data, { id: newId("L") }));
    revalidatePath("/", "layout");
    return NextResponse.json({ listing: saved }, { status: 201 });
  } catch (err) {
    if (err instanceof SlugTakenError) return jsonError(err.message, 409);
    return serverError(err, "create listing");
  }
}
