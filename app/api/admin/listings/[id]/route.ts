import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { toProperty, validateListing } from "@/lib/listings/input";
import { SlugTakenError, writableListingStore } from "@/lib/listings/store";

type Ctx = { params: Promise<{ id: string }> };

/** Update a listing (full form save). */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const store = writableListingStore();
    const existing = await store.get(id);
    if (!existing) return jsonError("This listing no longer exists.", 404);
    const body = await req.json().catch(() => null);
    const v = validateListing(body ?? {});
    if (!v.ok) return jsonError("Some fields need attention.", 422, { fields: v.errors });
    const saved = await store.save(toProperty(v.data, { id, existing }));
    revalidatePath("/", "layout");
    return NextResponse.json({ listing: saved });
  } catch (err) {
    if (err instanceof SlugTakenError) return jsonError(err.message, 409);
    return serverError(err, "update listing");
  }
}

/** Quick actions from the listings table: publish / unpublish / feature. */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { published?: unknown; featured?: unknown } | null;
  if (!body || (typeof body.published !== "boolean" && typeof body.featured !== "boolean")) return jsonError("Nothing to change.");
  try {
    const store = writableListingStore();
    const existing = await store.get(id);
    if (!existing) return jsonError("This listing no longer exists.", 404);
    const saved = await store.save({
      ...existing,
      published: typeof body.published === "boolean" ? body.published : existing.published,
      featured: typeof body.featured === "boolean" ? body.featured : existing.featured,
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ listing: saved });
  } catch (err) {
    return serverError(err, "patch listing");
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const removed = await writableListingStore().remove(id);
    if (!removed) return jsonError("This listing no longer exists.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "delete listing");
  }
}
