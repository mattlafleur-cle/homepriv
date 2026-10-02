import "server-only";
import { db, nowIso } from "./db";
import { customerByToken } from "./payments";
import { addressLine, firstName } from "./eligibility";
import { sendEmail, notifyOperator } from "./email";
import type { z } from "zod";
import type { onboardingSchema } from "./validation";
import { offer } from "@/config/offer";

const DAY = 24 * 60 * 60 * 1000;

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date(iso));
}

/**
 * Record written authorization and optional Street View consent. The service
 * clock (45-day window and day-60 recheck) starts here, not at payment.
 */
export async function completeOnboarding(token: string, data: z.output<typeof onboardingSchema>) {
  const found = customerByToken(token);
  if (!found?.order) return { error: "not_found" as const };
  const { order, inquiry } = found;
  if (order.status !== "awaiting_intake") return { error: "already_complete" as const };

  const now = new Date();
  const ends = new Date(now.getTime() + offer.serviceDays * DAY).toISOString();
  const recheck = new Date(now.getTime() + offer.recheckDay * DAY).toISOString();
  const nowS = now.toISOString();

  db()
    .prepare(
      `UPDATE orders SET authorization_name=?, authorization_at=?, listing_agent=?, owner_notes=?,
        street_view_consent=?, street_view_consent_at=?, intake_completed_at=?, service_ends_at=?, recheck_at=?,
        status='in_service', updated_at=? WHERE id=? AND status='awaiting_intake'`,
    )
    .run(
      data.authorizationName,
      nowS,
      data.listingAgent ?? null,
      data.ownerNotes ?? null,
      data.streetViewConsent ? 1 : 0,
      data.streetViewConsent ? nowS : null,
      nowS,
      ends,
      recheck,
      nowIso(),
      order.id,
    );

  await sendEmail({
    template: "intake_complete",
    to: inquiry.email,
    subject: `Your home cleanup has started (${order.order_number})`,
    relatedId: inquiry.id,
    paragraphs: [
      `Hi ${firstName(inquiry.name)},`,
      `Thanks. Onboarding for ${addressLine(inquiry)} is complete, and your service window has started.`,
      `* Active requests and follow-up through ${formatDate(ends)}`,
      `* An update from us every week during that time`,
      `* A final report when the window ends`,
      `* A recheck around ${formatDate(recheck)}`,
      data.streetViewConsent
        ? "You also asked us to guide a Google Street View blur request. We'll walk you through the owner steps Google requires. Remember that a blur, once applied, is permanent."
        : "You didn't ask for a Google Street View blur request. That's fine, and you can ask later.",
      "If a site needs something only the owner can do, such as verifying ownership, we'll tell you exactly what to do and why.",
    ],
  });
  await notifyOperator(`Onboarding complete ${order.order_number}`, [
    `Order ${order.order_number} completed onboarding. The service window is open.`,
  ]);
  return { ok: true as const, endsAt: ends, recheckAt: recheck };
}
