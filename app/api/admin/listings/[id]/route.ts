import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdmin, jsonError, serverError } from "@/lib/admin-api";
import { toProperty, validateListing } from "@/lib/listings/input";
import { SlugTakenError, StaleListingError, writableListingStore } from "@/lib/listings/store";
import { deleteUploads } from "@/lib/uploads";
import { ID_RE, readJson } from "@/lib/sanitize";

type Ctx = { params: Promise<{ id: string }> };

/** Update a listing (full form save). */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return jsonError("This listing no longer exists.", 404);
  try {
    const store = writableListingStore();
    const existing = await store.get(id);
    if (!existing) return jsonError("This listing no longer exists.", 404);
    const body = (await readJson(req)) as { rev?: unknown } | null;
    const v = validateListing(body ?? {});
    if (!v.ok) return jsonError("Some fields need attention.", 422, { fields: v.errors });
    const saved = await store.save(toProperty(v.data, { id, existing }), typeof body?.rev === "number" ? body.rev : undefined);
    // Photos removed from the listing are deleted from storage.
    await deleteUploads(existing.images.filter((u) => !saved.images.includes(u)));
    revalidatePath("/", "layout");
    return NextResponse.json({ listing: saved });
  } catch (err) {
    if (err instanceof SlugTakenError || err instanceof StaleListingError) return jsonError(err.message, 409);
    return serverError(err, "update listing");
  }
}

/** Quick actions from the listings table: publish / unpublish / feature. */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!ID_RE.test(id)) return jsonError("This listing no longer exists.", 404);
  const body = (await readJson(req)) as { published?: unknown; featured?: unknown } | null;
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
  if (!ID_RE.test(id)) return jsonError("This listing no longer exists.", 404);
  try {
    const store = writableListingStore();
    const existing = await store.get(id);
    if (!existing || !(await store.remove(id))) return jsonError("This listing no longer exists.", 404);
    await deleteUploads(existing.images);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "delete listing");
  }
}
