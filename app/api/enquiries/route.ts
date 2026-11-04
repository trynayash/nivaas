import { NextResponse } from "next/server";
import { sameOrigin, serverError } from "@/lib/admin-api";
import { enquiryStore } from "@/lib/enquiries/store";
import { enquirySchema } from "@/lib/enquiries/input";
import { fieldErrors } from "@/lib/listings/input";
import { listingStore } from "@/lib/listings/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ID_RE, readJson } from "@/lib/sanitize";

const MIN_FILL_MS = 2500;

/** Public: a visitor asks for a call back about a property. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Please use the form on the website." }, { status: 403 });
  const parsed = enquirySchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Please check the form.", fields: fieldErrors(parsed.error) }, { status: 422 });
  const v = parsed.data;

  // Bots fill the hidden field, skip the timer, or submit instantly. Pretend success so they don't adapt.
  if (v.website || typeof v.elapsedMs !== "number" || v.elapsedMs < MIN_FILL_MS) return NextResponse.json({ ok: true });

  // Only valid submissions count, so a visitor fixing a typo isn't locked out.
  // 5 per address per 10 minutes, and 200 per hour overall — shared by all server instances.
  const perIp = await rateLimit(`enq:${clientIp(req)}`, 5, 10 * 60_000);
  const overall = perIp.ok ? await rateLimit("enq:all", 200, 60 * 60_000) : perIp;
  if (!perIp.ok || !overall.ok) {
    const retryAfter = perIp.ok ? overall.retryAfter : perIp.retryAfter;
    return NextResponse.json(
      { error: "We’ve received several requests already. Please try again in a few minutes, or use WhatsApp." },
      { status: 429, headers: { "retry-after": String(retryAfter) } }
    );
  }
  try {
    const property = v.propertyId && ID_RE.test(v.propertyId) ? await listingStore().get(v.propertyId) : undefined;
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
