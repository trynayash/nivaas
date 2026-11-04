import Link from "next/link";

export default function NotFound() {
  return (
    <main className="notfound">
      <h1>Page not found</h1>
      <p>The property or page you’re looking for doesn’t exist or was removed.</p>
      <Link className="btn btn-primary" href="/search">
        Search properties
      </Link>
    </main>
  );
}
