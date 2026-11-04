"use client";

/** Last-resort error screen if the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f3ee", color: "#1d211e", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontWeight: 500 }}>Something went wrong</h1>
          <p>The site couldn’t load. Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 16px", border: 0, borderRadius: 4, background: "#1d211e", color: "#f5f3ee", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
