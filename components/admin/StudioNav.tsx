"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/format";

export type StudioSection = "page" | "listings" | "enquiries";

const ITEMS: { key: StudioSection; label: string; href: string }[] = [
  { key: "page", label: "Landing page", href: "/admin" },
  { key: "listings", label: "Listings", href: "/admin/listings" },
  { key: "enquiries", label: "Enquiries", href: "/admin/enquiries" },
];

export function StudioNav({ active, newEnquiries }: { active: StudioSection; newEnquiries?: number }) {
  return (
    <nav className="st-nav" aria-label="Studio">
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className={cx(active === it.key && "is-on")} aria-current={active === it.key ? "page" : undefined}>
          {it.label}
          {it.key === "enquiries" && newEnquiries ? <span className="st-count">{newEnquiries}</span> : null}
        </Link>
      ))}
    </nav>
  );
}


/** Header for Studio pages other than the landing-page editor. */
export function StudioHeader({ active, newEnquiries, children }: { active: StudioSection; newEnquiries?: number; children?: React.ReactNode }) {
  return (
    <header className="st-top st-top-page">
      <Link href="/admin" className="st-brand">
        <b>Nivaas Studio</b>
      </Link>
      <StudioNav active={active} newEnquiries={newEnquiries} />
      <div className="st-top-actions">
        {children}
        <a className="st-btn st-btn-ghost" href="/" target="_blank" rel="noreferrer">
          Open site ↗
        </a>
        <LogoutButton />
      </div>
    </header>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="st-btn st-btn-ghost"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
