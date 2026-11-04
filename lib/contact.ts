// WhatsApp click-to-chat for the site's contact CTAs. The number comes from CONTACT_WHATSAPP.
// Pure module: safe on server and client. Read the env var on the server and pass it down.

export interface ContactConfig {
  /** Digits only, international format without "+", e.g. "919876543210". Null when not configured. */
  whatsapp: string | null;
  /** Prefilled chat message for this page. */
  message: string;
}

/** Hrefs in CMS content that mean "contact us". */
export const CONTACT_HREFS = new Set(["#contact", "whatsapp", "#whatsapp"]);

/**
 * Normalise a phone number for wa.me: strip spaces, "+", dashes and a leading 0.
 * A bare 10-digit Indian mobile number gets the 91 country code.
 */
export function normalizeWhatsApp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Server-side: the configured number, or null (CTAs then keep their original href). */
export function whatsappFromEnv(): string | null {
  return normalizeWhatsApp(process.env.CONTACT_WHATSAPP);
}

export const DEFAULT_CONTACT_MESSAGE = "Hi, I'd like to talk to the Nivaas listings team about selling my property.";

export function propertyContactMessage(title: string, price: string, url: string) {
  return `Hi, I'm interested in this property on Nivaas:\n${title} — ${price}\n${url}`;
}

/** Resolve a CMS link: contact hrefs become a WhatsApp link when a number is configured. */
export function resolveContactHref(href: string, contact?: ContactConfig): { href: string; external: boolean } {
  if (contact?.whatsapp && CONTACT_HREFS.has(href.trim().toLowerCase())) {
    return { href: waLink(contact.whatsapp, contact.message), external: true };
  }
  return { href, external: /^https?:\/\//.test(href) };
}
