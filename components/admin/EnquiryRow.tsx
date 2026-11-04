"use client";

import { useState } from "react";
import type { Enquiry, EnquiryStatus } from "@/lib/enquiries/store";
import { normalizeWhatsApp, waLink } from "@/lib/contact";
import { api } from "@/lib/client-api";

export function EnquiryRow({ e }: { e: Enquiry }) {
  const [status, setStatus] = useState<EnquiryStatus>(e.status);
  const [note, setNote] = useState(e.note ?? "");
  const [saved, setSaved] = useState(e.note ?? "");
  const [busy, setBusy] = useState(false);
  const wa = normalizeWhatsApp(e.phone);
  const reply = `Hi ${e.name.split(" ")[0]}, this is the Nivaas listings team${e.propertyTitle ? ` about ${e.propertyTitle}` : ""}.`;

  async function patch(body: { status?: EnquiryStatus; note?: string }) {
    setBusy(true);
    const r = await api(`/api/admin/enquiries/${e.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!r.ok) {
      alert(r.error);
      return false;
    }
    return true;
  }

  return (
    <tr className={`enq-row is-${status}`}>
      <td className="num">
        {new Date(e.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
      </td>
      <td>
        <b>{e.name}</b>
        <div>
          <a href={`tel:${e.phone}`} className="mono">
            {e.phone}
          </a>
        </div>
        {e.email && <div className="st-hint">{e.email}</div>}
      </td>
      <td>
        {e.propertySlug ? (
          <a href={`/property/${e.propertySlug}`} target="_blank" rel="noreferrer" className="st-table-title">
            {e.propertyTitle}
          </a>
        ) : (
          <span className="st-hint">General enquiry</span>
        )}
        <p className="enq-msg">{e.message}</p>
        <input
          className="st-input enq-note"
          placeholder="Private note (saved when you leave the field)"
          value={note}
          maxLength={2000}
          onChange={(ev) => setNote(ev.target.value)}
          onBlur={async () => {
            if (note !== saved && (await patch({ note }))) setSaved(note);
          }}
          aria-label={`Note for ${e.name}`}
        />
      </td>
      <td>
        <select
          className="st-input"
          value={status}
          disabled={busy}
          aria-label={`Status for ${e.name}`}
          onChange={async (ev) => {
            const next = ev.target.value as EnquiryStatus;
            const prev = status;
            setStatus(next);
            if (!(await patch({ status: next }))) setStatus(prev);
          }}
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
      </td>
      <td className="st-table-actions">
        {wa && (
          <a className="st-btn st-btn-small" href={waLink(wa, reply)} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        )}
        <a className="st-btn st-btn-small st-btn-ghost" href={`tel:${e.phone}`}>
          Call
        </a>
      </td>
    </tr>
  );
}
