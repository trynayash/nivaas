import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { STUDIO_FONTS_HREF } from "@/lib/cms/schema";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const configured = adminConfigured();
  return (
    <main className="login">
      <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
      <div className="login-card">
        <p className="login-mark">Nivaas Studio</p>
        <h1>Sign in</h1>
        {configured ? (
          <LoginForm />
        ) : (
          <p className="login-error" role="alert">
            Sign-in is disabled because <code>ADMIN_PASSWORD</code> is not set. Add it to <code>.env.local</code> (or your host’s environment variables) and restart the server.
          </p>
        )}
      </div>
    </main>
  );
}
