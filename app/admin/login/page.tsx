import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin, usingDefaultPassword } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const showHint = usingDefaultPassword() && process.env.NODE_ENV !== "production";
  return (
    <main className="login">
      <div className="login-card">
        <span className="st-logo">N</span>
        <h1>Sign in to Studio</h1>
        <p>Edit the website’s content and design.</p>
        <LoginForm />
        {showHint && (
          <p className="st-hint">
            Development default password: <code>admin</code>. Set <code>ADMIN_PASSWORD</code> to change it.
          </p>
        )}
      </div>
    </main>
  );
}
