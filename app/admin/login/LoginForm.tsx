"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        const r = await api("/api/admin/login", { method: "POST", body: { password } });
        if (r.ok) {
          router.replace("/admin");
          router.refresh();
          return; // keep the button busy while Studio loads
        }
        setError(r.status === 401 ? "That password didn’t work." : r.error);
        setBusy(false);
      }}
    >
      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required autoFocus />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="st-btn st-btn-primary st-btn-block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
