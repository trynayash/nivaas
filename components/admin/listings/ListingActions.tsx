"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Publish / unpublish toggle in the listings table. */
export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(published);
  return (
    <label className="st-switch st-switch-sm" title={on ? "Visible on the website" : "Hidden (draft)"}>
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        aria-label={on ? "Unpublish listing" : "Publish listing"}
        onChange={async (e) => {
          const next = e.target.checked;
          setBusy(true);
          setOn(next);
          const res = await fetch(`/api/admin/listings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ published: next }) });
          setBusy(false);
          if (!res.ok) {
            setOn(!next);
            alert((await res.json().catch(() => ({}))).error ?? "Couldn’t change this listing.");
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
        const res = await fetch("/api/admin/listings/remove-samples", { method: "POST" });
        setBusy(false);
        if (res.ok) router.refresh();
        else alert((await res.json().catch(() => ({}))).error ?? "Couldn’t remove the samples.");
      }}
    >
      {busy ? "Removing…" : `Remove ${count} sample listings`}
    </button>
  );
}
