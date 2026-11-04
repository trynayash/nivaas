import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EnquiryRow } from "@/components/admin/EnquiryRow";
import { StudioHeader } from "@/components/admin/StudioNav";
import { isAdmin } from "@/lib/auth";
import { STUDIO_FONTS_HREF } from "@/lib/cms/schema";
import { ENQUIRY_STATUSES, enquiryStore, type EnquiryStatus } from "@/lib/enquiries/store";
import { cx } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enquiries · Studio", robots: { index: false } };

const LABEL: Record<string, string> = { all: "All", new: "New", contacted: "Contacted", closed: "Closed" };

export default async function EnquiriesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const sp = await searchParams;
  const status = (ENQUIRY_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as EnquiryStatus) : undefined;
  const PER_PAGE = 50;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [counts, rows] = await Promise.all([
    enquiryStore().counts(),
    enquiryStore().list({ status, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
  ]);
  const total = status ? counts[status] : counts.all;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageHref = (n: number) => `/admin/enquiries?${new URLSearchParams({ ...(status && { status }), ...(n > 1 && { page: String(n) }) }).toString()}`;

  return (
    <div className="studio-page">
      <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
      <StudioHeader active="enquiries" newEnquiries={counts.new}>
        {counts.all > 0 && (
          // A file download from an API route, so a plain <a download> rather than <Link>.
          <a className="st-btn" href="/api/admin/enquiries/export" download>
            Download CSV
          </a>
        )}
      </StudioHeader>
      <main className="st-page">
        <div className="st-page-head">
          <div>
            <h1>Enquiries</h1>
            <p className="st-hint">Call-back requests from property pages. Times are in IST.</p>
          </div>
        </div>
        <nav className="st-tabs-row" aria-label="Filter by status">
          {(["all", ...ENQUIRY_STATUSES] as const).map((s) => (
            <Link key={s} href={s === "all" ? "/admin/enquiries" : `/admin/enquiries?status=${s}`} className={cx((status ?? "all") === s && "is-on")}>
              {LABEL[s]} <span className="num">{counts[s]}</span>
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <div className="st-empty-box">
            <p>{counts.all ? "Nothing here." : "No enquiries yet. They appear here when visitors use “Request a call back” on a property page."}</p>
          </div>
        ) : (
          <table className="st-table st-table-enq">
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>Property and message</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Reply</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <EnquiryRow key={e.id} e={e} />
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 && (
          <nav className="st-pager" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={pageHref(n)} className={n === page ? "is-on" : undefined} aria-current={n === page ? "page" : undefined}>
                {n}
              </Link>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}
