"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";

/** Publish / unpublish toggle in the listings table. */
export function PublishToggle({ id, published, title }: { id: string; published: boolean; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(published);
  return (
    <label className="st-switch st-switch-sm" title={on ? "Visible on the website" : "Hidden (draft)"}>
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        aria-label={`Live on the website: ${title}`}
        onChange={async (e) => {
          const next = e.target.checked;
          setBusy(true);
          setOn(next);
          const r = await api(`/api/admin/listings/${id}`, { method: "PATCH", body: { published: next } });
          setBusy(false);
          if (!r.ok) {
            setOn(!next);
            alert(r.error);
          } else router.refresh();
        }}
      />
      <span className="st-switch-track" aria-hidden="true" />
      <span>{on ? "Live" : "Draft"}</span>
    </label>
  );
}

export function RemoveSamplesButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!count) return null;
  return (
    <button
      type="button"
      className="st-btn st-btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Delete all ${count} sample listings? Your own listings are kept. Samples won’t come back.`)) return;
        setBusy(true);
        const r = await api("/api/admin/listings/remove-samples", { method: "POST" });
        setBusy(false);
        if (r.ok) router.refresh();
        else alert(r.error);
      }}
    >
      {busy ? "Removing…" : `Remove ${count} sample listings`}
    </button>
  );
}
