"use client";

import { useRef, useState } from "react";

type Errors = Record<string, string>;

/** "Request a call back" form on the property page. Saves to the Studio enquiry inbox. */
export function EnquiryForm({ propertyId, title, whatsappHref }: { propertyId: string; title: string; whatsappHref?: string }) {
  const opened = useRef(Date.now());
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [sentPhone, setSentPhone] = useState("");

  if (state === "sent") {
    return (
      <div className="enq enq-sent" role="status">
        <p className="enq-title">Thanks — we’ve got your request.</p>
        <p>The listings team will call you on {sentPhone}, usually within a working day.</p>
        {whatsappHref && (
          <a className="text-link" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            Chat on WhatsApp instead
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className="enq"
      noValidate
      onChange={(e) => {
        // Clear a field's error as soon as the visitor edits it.
        const name = (e.target as unknown as HTMLInputElement).name;
        if (errors[name] || errors._) setErrors(({ [name]: _gone, _: _general, ...rest }) => rest);
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
          propertyId,
          name: String(fd.get("name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          message: String(fd.get("message") ?? ""),
          website: String(fd.get("website") ?? ""),
          elapsedMs: Date.now() - opened.current,
        };
        setState("sending");
        setErrors({});
        try {
          const res = await fetch("/api/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErrors(data.fields ?? { _: data.error ?? "Couldn’t send. Please try again." });
            setState("idle");
            return;
          }
          setSentPhone(body.phone);
          setState("sent");
        } catch {
          setErrors({ _: "Network error — please try again." });
          setState("idle");
        }
      }}
    >
      <p className="enq-title">Ask about this home</p>
      <label>
        <span>Name</span>
        <input name="name" autoComplete="name" required maxLength={80} aria-invalid={!!errors.name || undefined} />
        {errors.name && <em role="alert">{errors.name}</em>}
      </label>
      <label>
        <span>Mobile number</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="98765 43210" aria-invalid={!!errors.phone || undefined} />
        {errors.phone && <em role="alert">{errors.phone}</em>}
      </label>
      <label>
        <span>Message</span>
        <textarea name="message" rows={3} maxLength={1500} defaultValue={`I’m interested in ${title}. Please call me.`} aria-invalid={!!errors.message || undefined} />
        {errors.message && <em role="alert">{errors.message}</em>}
      </label>
      {/* Honeypot: hidden from people, filled by bots */}
      <label className="enq-hp" aria-hidden="true">
        Website <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {errors._ && (
        <p className="enq-error" role="alert">
          {errors._}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request a call back"}
      </button>
      {whatsappHref && (
        <a className="btn btn-secondary btn-block" href={whatsappHref} target="_blank" rel="noopener noreferrer">
          Chat on WhatsApp
        </a>
      )}
    </form>
  );
}
