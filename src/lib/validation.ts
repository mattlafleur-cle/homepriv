import { z } from "zod";
import { US_STATES } from "./states";

/**
 * Shared by the browser form (for instant feedback) and the server (which is
 * authoritative). Messages are written for customers.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const urlList = z
  .string()
  .trim()
  .max(2000, "Please include five links or fewer.")
  .optional()
  .transform((v, ctx) => {
    if (!v) return [] as string[];
    const parts = v
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 5) {
      ctx.addIssue({ code: "custom", message: "Please include five links or fewer." });
      return z.NEVER;
    }
    for (const p of parts) {
      try {
        const u = new URL(p);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "One of these doesn't look like a web address. Paste full links starting with https://, one per line.",
        });
        return z.NEVER;
      }
    }
    return parts;
  });

export { US_STATES };

export const eligibilitySchema = z.object({
  street: trimmed(200).min(3, "Enter the street address of the home."),
  unit: optionalText(40),
  city: trimmed(100).min(2, "Enter the city."),
  state: z.enum(US_STATES, { message: "Choose the state." }),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  name: trimmed(120).min(2, "Enter your full name."),
  email: z.string().trim().max(254).email("Enter an email address like name@example.com."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number, or leave this blank."),
  relationship: z.enum(["owner", "authorized"], {
    message: "Tell us whether you own the home or are authorized by the owner.",
  }),
  listingStatus: z.enum(["not_listed", "listed", "unsure"], {
    message: "Tell us whether the home is listed for sale or rent right now.",
  }),
  listingLinks: urlList,
  notes: optionalText(1000),
  authorizationConfirmed: z.literal(true, {
    message: "Please confirm you own the home or are authorized to act for the owner.",
  }),
  serviceConsent: z.literal(true, {
    message: "Please agree so we can use these details to review your home.",
  }),
  marketingConsent: z.boolean().default(false),
});

export type EligibilityInput = z.input<typeof eligibilitySchema>;
export type EligibilityData = z.output<typeof eligibilitySchema>;

export const agentInquirySchema = z.object({
  name: trimmed(120).min(2, "Enter your name."),
  email: z.string().trim().max(254).email("Enter an email address like name@example.com."),
  brokerage: optionalText(150),
  message: optionalText(1500),
  contactConsent: z.literal(true, { message: "Please agree so we can reply to you." }),
  marketingConsent: z.boolean().default(false),
});

export const onboardingSchema = z.object({
  authorizationName: trimmed(120).min(2, "Type your full name to sign."),
  authorizationConfirmed: z.literal(true, {
    message: "Please confirm the authorization statement to continue.",
  }),
  listingAgent: optionalText(300),
  ownerNotes: optionalText(1500),
  streetViewConsent: z.boolean().default(false),
});

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
