"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
        if (res.ok) {
          router.replace("/admin");
          router.refresh();
        }
        else {
          const data = await res.json().catch(() => ({}));
          setError(res.status === 429 ? data.error : "That password didn’t work.");
          setBusy(false);
        }
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
