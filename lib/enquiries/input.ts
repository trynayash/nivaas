import { z } from "zod";

/** Indian mobile (10 digits starting 6–9, optional +91/0) or any international number with a + prefix. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+") && !s.startsWith("+91")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  const local = digits.replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

export const enquirySchema = z.object({
  propertyId: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2, "Please enter your name.").max(80, "That name is too long."),
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number." });
      return n ?? v;
    }),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("That email doesn’t look right.").optional()),
  message: z.string().trim().min(5, "Add a short message.").max(1500, "Please keep the message under 1500 characters."),
  // Spam traps: a hidden field people never fill, and how long the form was open.
  website: z.string().max(200).optional(),
  elapsedMs: z.number().optional(),
});
export type EnquiryInput = z.input<typeof enquirySchema>;
