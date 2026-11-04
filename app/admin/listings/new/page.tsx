import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/admin/listings/ListingForm";
import { StudioHeader } from "@/components/admin/StudioNav";
import { isAdmin } from "@/lib/auth";
import { STUDIO_FONTS_HREF } from "@/lib/cms/schema";
import { newEnquiryCount } from "@/lib/enquiries/count";
import { toInput } from "@/lib/listings/input";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New listing · Studio", robots: { index: false } };

export default async function NewListing() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="studio-page">
      <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
      <StudioHeader active="listings" newEnquiries={await newEnquiryCount()} />
      <main className="st-page st-page-narrow">
        <p className="st-crumb">
          <Link href="/admin/listings">Listings</Link> <span>›</span> <b>New listing</b>
        </p>
        <h1>New listing</h1>
        <ListingForm initial={toInput()} />
      </main>
    </div>
  );
}
