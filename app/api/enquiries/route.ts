import { NextResponse } from "next/server";
import { sameOrigin, serverError } from "@/lib/admin-api";
import { enquiryStore } from "@/lib/enquiries/store";
import { enquirySchema } from "@/lib/enquiries/input";
import { fieldErrors } from "@/lib/listings/input";
import { listingStore } from "@/lib/listings/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Public: a visitor asks for a call back about a property. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Please use the form on the website." }, { status: 403 });
  const limit = rateLimit(`enq:${clientIp(req)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "You’ve sent several enquiries already. Please try again in a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }
  const body = await req.json().catch(() => null);
  const parsed = enquirySchema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Please check the form.", fields: fieldErrors(parsed.error) }, { status: 422 });
  const v = parsed.data;
  // Bots fill hidden fields and submit instantly. Pretend success so they don't adapt.
  if (v.website || (v.elapsedMs !== undefined && v.elapsedMs < 2500)) return NextResponse.json({ ok: true });
  try {
    const property = v.propertyId ? await listingStore().get(v.propertyId) : undefined;
    if (v.propertyId && (!property || !property.published)) {
      return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    }
    const origin = new URL(req.url).origin;
    await enquiryStore().create({
      propertyId: property?.id ?? null,
      propertyTitle: property ? `${property.title}, ${property.location.cityName}` : null,
      propertySlug: property?.slug ?? null,
      name: v.name,
      phone: v.phone,
      email: v.email ?? null,
      message: v.message,
      pageUrl: property ? `${origin}/property/${property.slug}` : null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serverError(err, "create enquiry");
  }
}
