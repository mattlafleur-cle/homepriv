import "server-only";
import { db, nowIso, tx } from "./db";
import { hashToken, isWellFormedToken, newAccessToken, newId, newRefCode } from "./tokens";
import type { EligibilityData } from "./validation";
import { sendEmail, notifyOperator } from "./email";
import { track } from "./events";
import { effectiveMode, paymentProvider, siteUrl } from "@/config/site";
import { offer } from "@/config/offer";

export type InquiryStatus = "pending_review" | "listed_not_eligible" | "approved" | "declined" | "paid";

export type InquiryRow = {
  id: string;
  ref_code: string;
  status: InquiryStatus;
  mode: string;
  is_test: number;
  name: string;
  email: string;
  phone: string | null;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
  relationship: string;
  listing_status: string;
  listing_links: string;
  notes: string | null;
  marketing_consent: number;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export const DECLINE_REASONS = {
  listed: "The home is listed for sale or rent right now. The service is for homes that are off the market, so please come back after the listing ends.",
  no_exposure:
    "We looked and didn't find listing photos, floor plans, or virtual tours of the home that we could ask to have removed or hidden from public view. That's good news, and it means the service wouldn't do much for you.",
  out_of_area: `We're starting with homes in ${offer.serviceArea}, and we can't take this address yet.`,
  other: "After reviewing the details, we're not able to take this home right now.",
} as const;
export type DeclineReason = keyof typeof DECLINE_REASONS;

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "there";
}

export function addressLine(i: Pick<InquiryRow, "street" | "unit" | "city" | "state" | "zip">) {
  return `${i.street}${i.unit ? `, ${i.unit}` : ""}, ${i.city}, ${i.state} ${i.zip}`;
}

/**
 * Store an eligibility request. Homes that are listed right now are told so
 * immediately and never reach payment. Everything else waits for a person to
 * review it. No automatic exposure scan runs here.
 */
export async function submitInquiry(data: EligibilityData) {
  const mode = effectiveMode();
  const id = newId();
  const refCode = newRefCode();
  const now = nowIso();
  const status: InquiryStatus = data.listingStatus === "listed" ? "listed_not_eligible" : "pending_review";

  await db.run(`INSERT INTO inquiries(id, ref_code, status, mode, is_test, name, email, phone, street, unit, city, state, zip,
        relationship, listing_status, listing_links, notes, service_consent_at, marketing_consent, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
      id,
      refCode,
      status,
      mode,
      mode === "preview" ? 1 : 0,
      data.name,
      data.email.toLowerCase(),
      data.phone ?? null,
      data.street,
      data.unit ?? null,
      data.city,
      data.state,
      data.zip,
      data.relationship,
      data.listingStatus,
      JSON.stringify(data.listingLinks),
      data.notes ?? null,
      now,
      data.marketingConsent ? 1 : 0,
      now,
      now,
    );

  await track("eligibility_submitted", { subject: id });

  const hi = `Hi ${firstName(data.name)},`;
  if (status === "listed_not_eligible") {
    await sendEmail({
      template: "inquiry_listed",
      to: data.email,
      subject: `We received your request (${refCode})`,
      relatedId: id,
      paragraphs: [
        hi,
        "Thanks for reaching out. You told us the home is listed for sale or rent right now. Our service is built for homes that are off the market, because active listings are supposed to show photos.",
        "Once the listing ends, you're welcome to start a new request. We haven't charged you anything.",
        `Your reference number is ${refCode}.`,
      ],
    });
  } else {
    await sendEmail({
      template: "inquiry_received",
      to: data.email,
      subject: `We received your request (${refCode})`,
      relatedId: id,
      paragraphs: [
        hi,
        `Thanks for telling us about your home. A person will review it before anything is charged. We look at whether the home is off the market and whether there are listing photos, floor plans, or virtual tours we can work on.`,
        mode === "interest"
          ? "Paid ordering isn't open yet. We'll let you know what we find and when ordering opens."
          : `If it's a fit, we'll email you a secure link to pay ${offer.priceLabel}. If it isn't, we'll tell you why.`,
        `Your reference number is ${refCode}. Reply to this email if you have questions.`,
      ],
    });
    await notifyOperator(`New eligibility request ${refCode}`, [`A new eligibility request (${refCode}) is waiting for review.`], id);
  }

  return { refCode, status };
}

export async function findInquiry(idOrRef: string): Promise<InquiryRow | undefined> {
  return await db.get("SELECT * FROM inquiries WHERE id = ? OR ref_code = ?", idOrRef, idOrRef.toUpperCase()) as InquiryRow | undefined;
}

export async function inquiryByToken(token: string): Promise<InquiryRow | undefined> {
  if (!isWellFormedToken(token)) return undefined;
  return await db.get("SELECT * FROM inquiries WHERE access_token_hash = ?", hashToken(token)) as
    | InquiryRow
    | undefined;
}

export function customerLink(token: string) {
  return `${siteUrl()}/c/${token}`;
}

/**
 * Approve a request and issue a fresh secure link. Re-running it on an
 * approved request replaces the link (the old one stops working).
 */
export async function approveInquiry(idOrRef: string, decidedBy: string, note?: string) {
  const found = await findInquiry(idOrRef);
  if (!found) throw new Error("Inquiry not found");
  if (found.status !== "pending_review" && found.status !== "approved") {
    throw new Error(`Inquiry is ${found.status} and cannot be approved`);
  }
  const token = newAccessToken();
  const now = nowIso();
  await db.run("UPDATE inquiries SET status='approved', access_token_hash=?, decided_at=?, decided_by=?, decision_note=COALESCE(?, decision_note), updated_at=? WHERE id=?", hashToken(token), now, decidedBy, note ?? null, now, found.id);
  await track("eligibility_approved", { subject: found.id, isTest: Boolean(found.is_test) });

  const link = customerLink(token);
  const canPay = paymentProvider() !== "none";
  await sendEmail({
    template: canPay ? "approved_checkout" : "approved_interest",
    to: found.email,
    subject: canPay ? `Your home qualifies (${found.ref_code})` : `Good news about your home (${found.ref_code})`,
    relatedId: found.id,
    paragraphs: canPay
      ? [
          `Hi ${firstName(found.name)},`,
          `We reviewed ${addressLine(found)} and it qualifies for Home Privacy Cleanup.`,
          `The price is ${offer.priceLabel}, paid once, for this one home. Payment is handled by Stripe on a secure checkout page. We never see your card number.`,
          `After you pay, a short onboarding form asks for your written authorization. Your ${offer.serviceDays}-day service window starts when that form is complete.`,
          "This link is just for you. Please don't forward it.",
        ]
      : [
          `Hi ${firstName(found.name)},`,
          `We reviewed ${addressLine(found)} and it looks like a fit for Home Privacy Cleanup.`,
          "Paid ordering isn't open yet. When it opens, we'll send you a secure link to start. You don't need to do anything now.",
        ],
    button: canPay ? { label: "Review and pay", url: link } : undefined,
  });

  return { token, link, refCode: found.ref_code };
}

export async function declineInquiry(idOrRef: string, decidedBy: string, reason: DeclineReason, note?: string) {
  const found = await findInquiry(idOrRef);
  if (!found) throw new Error("Inquiry not found");
  if (found.status === "paid") throw new Error("Inquiry is already paid; refund it instead");
  const now = nowIso();
  await db.run("UPDATE inquiries SET status='declined', access_token_hash=NULL, decided_at=?, decided_by=?, decision_note=?, updated_at=? WHERE id=?", now, decidedBy, note ? `${reason}: ${note}` : reason, now, found.id);

  await sendEmail({
    template: "declined",
    to: found.email,
    subject: `About your home cleanup request (${found.ref_code})`,
    relatedId: found.id,
    paragraphs: [
      `Hi ${firstName(found.name)},`,
      "Thanks for your patience while we looked at your home.",
      DECLINE_REASONS[reason],
      "You haven't been charged anything. If your situation changes, you're welcome to send a new request.",
    ],
  });
  return { refCode: found.ref_code };
}

/** Delete one inquiry and its unpaid checkout records. Paid orders are kept as business records. */
export async function deleteInquiry(idOrRef: string) {
  const found = await findInquiry(idOrRef);
  if (!found) return false;
  if (found.status === "paid") throw new Error("Paid orders are business records; use the order deletion process in docs/DATA_HANDLING.md");
  await tx(async (q) => {
    await q.run("DELETE FROM checkouts WHERE inquiry_id = ?", found.id);
    await q.run("DELETE FROM email_outbox WHERE related_id = ?", found.id);
    await q.run("DELETE FROM inquiries WHERE id = ?", found.id);
  });
  return true;
}
