import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/admin/listings/ListingForm";
import { StudioHeader } from "@/components/admin/StudioNav";
import { isAdmin } from "@/lib/auth";
import { STUDIO_FONTS_HREF } from "@/lib/cms/schema";
import { newEnquiryCount } from "@/lib/enquiries/count";
import { toInput } from "@/lib/listings/input";
import { listingStore } from "@/lib/listings/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit listing · Studio", robots: { index: false } };

export default async function EditListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const p = await listingStore().get(id);
  if (!p) notFound();
  const sp = await searchParams;
  return (
    <div className="studio-page">
      <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
      <StudioHeader active="listings" newEnquiries={await newEnquiryCount()} />
      <main className="st-page st-page-narrow">
        <p className="st-crumb">
          <Link href="/admin/listings">Listings</Link> <span>›</span> <b className="mono">{p.id}</b>
        </p>
        <h1>{p.title}</h1>
        {sp.saved && <p className="st-flash">Listing created{p.published ? " and published" : " as a draft"}.</p>}
        <ListingForm initial={toInput(p)} id={p.id} slug={p.slug} isSample={p.isSample} />
      </main>
    </div>
  );
}
