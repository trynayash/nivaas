"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page fails to render (e.g. the database is briefly unreachable). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="notfound">
      <h1>Something went wrong</h1>
      <p>This page couldn’t load just now. It’s usually temporary — please try again.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-secondary" href="/">
          Go to the homepage
        </Link>
      </div>
      {error.digest && <p className="hint">Reference: {error.digest}</p>}
    </main>
  );
}
