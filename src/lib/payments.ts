import "server-only";
import Stripe from "stripe";
import { db, nowIso, tx } from "./db";
import { hashToken, newAccessToken, newId, newRefCode } from "./tokens";
import {
  addressLine,
  approveInquiry,
  customerLink,
  declineInquiry,
  deleteInquiry,
  findInquiry,
  firstName,
  holdsEnabled,
  inquiryByToken,
  type DeclineReason,
  type InquiryRow,
} from "./eligibility";
import { sendEmail, notifyOperator } from "./email";
import { track } from "./events";
import { paymentProvider, siteUrl, stripeKeys } from "@/config/site";
import { offer } from "@/config/offer";

/**
 * Payment flow.
 *
 * - The amount always comes from src/config/offer.ts on the server.
 * - An order exists only after a verified confirmation: a signed Stripe
 *   webhook, or (preview mode only) the on-site simulated test payment.
 *   Landing on the checkout success URL proves nothing and creates nothing.
 * - Confirmation is idempotent: repeated or concurrent webhooks for the same
 *   checkout produce exactly one order, one email, and one purchase event.
 * - Card holds (purpose 'hold'): placed right after the request form, charged
 *   only when the operator approves the home, released on decline or delete.
 *   A hold is "authorized" only after Stripe confirms the PaymentIntent is
 *   waiting for capture. Holds usually last about 7 days (Visa can be
 *   shorter); an expired hold falls back to emailing a payment link.
 */

export type CheckoutRow = {
  id: string;
  inquiry_id: string;
  provider: "stripe" | "simulated";
  provider_session_id: string;
  status: "open" | "processing" | "authorized" | "released" | "completed" | "expired" | "canceled" | "failed";
  amount_cents: number;
  currency: string;
  url: string | null;
  purpose: "pay" | "hold";
  payment_intent: string | null;
  authorized_at: string | null;
  created_at: string;
};

/** Holds older than this are shown as at risk of expiring in /admin. */
export const HOLD_WARN_DAYS = 5;

export function holdAgeDays(authorizedAt: string, now = Date.now()) {
  return Math.floor((now - Date.parse(authorizedAt)) / 86_400_000);
}

export type OrderRow = {
  id: string;
  order_number: string;
  inquiry_id: string;
  checkout_id: string;
  provider: string;
  provider_payment_ref: string | null;
  amount_cents: number;
  currency: string;
  is_test: number;
  status: "awaiting_intake" | "in_service" | "completed" | "refunded";
  paid_at: string;
  authorization_name: string | null;
  authorization_at: string | null;
  listing_agent: string | null;
  owner_notes: string | null;
  street_view_consent: number;
  street_view_consent_at: string | null;
  intake_completed_at: string | null;
  service_ends_at: string | null;
  recheck_at: string | null;
  refunded_at: string | null;
};

let stripeClient: Stripe | undefined;
export function stripe() {
  const { secretKey } = stripeKeys();
  if (!secretKey) throw new Error("Stripe is not configured");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export class CheckoutUnavailable extends Error {}

/** Resolve a customer link token to its inquiry and (if paid) order. */
export async function customerByToken(token: string): Promise<{ inquiry: InquiryRow; order?: OrderRow } | undefined> {
  const inquiry = await inquiryByToken(token);
  if (inquiry) {
    const order = await db.get("SELECT * FROM orders WHERE inquiry_id = ?", inquiry.id) as OrderRow | undefined;
    return { inquiry, order };
  }
  const order = await db.get("SELECT * FROM orders WHERE access_token_hash = ?", hashToken(token)) as
    | OrderRow
    | undefined;
  if (!order) return undefined;
  const inq = await db.get("SELECT * FROM inquiries WHERE id = ?", order.inquiry_id) as InquiryRow;
  return { inquiry: inq, order };
}

export async function latestCheckout(inquiryId: string) {
  return await db.get("SELECT * FROM checkouts WHERE inquiry_id = ? ORDER BY created_at DESC LIMIT 1", inquiryId) as CheckoutRow | undefined;
}

/** Create (or reuse) a checkout for an approved inquiry and return where to send the customer. */
export async function startCheckout(token: string): Promise<{ redirectTo: string }> {
  const found = await customerByToken(token);
  if (!found) throw new CheckoutUnavailable("not_found");
  const { inquiry, order } = found;
  if (order || inquiry.status === "paid") return { redirectTo: `/c/${token}` };
  if (inquiry.status !== "approved") throw new CheckoutUnavailable("not_approved");

  const provider = paymentProvider();
  if (provider === "none") throw new CheckoutUnavailable("ordering_closed");

  // Reuse a recent open payment session instead of creating duplicates on double-clicks.
  // Hold sessions are never reused here: a payment link must charge immediately.
  const existing = await db.get("SELECT * FROM checkouts WHERE inquiry_id = ? AND purpose = 'pay' ORDER BY created_at DESC LIMIT 1", inquiry.id) as
    | CheckoutRow
    | undefined;
  const fresh = existing && Date.now() - Date.parse(existing.created_at) < 20 * 60 * 60 * 1000;
  if (existing && fresh && existing.status === "open" && existing.provider === provider && existing.url) {
    return { redirectTo: existing.url };
  }
  if (existing && existing.status === "processing") return { redirectTo: `/c/${token}` };

  const checkoutId = newId();
  const now = nowIso();
  let sessionId: string;
  let url: string;

  if (provider === "stripe") {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: offer.currency,
              unit_amount: offer.priceCents,
              product_data: {
                name: offer.productName,
                description: `Managed removal and suppression requests for one off-market home, ${offer.serviceDays}-day service window, final report, and day-${offer.recheckDay} recheck.`,
              },
            },
          },
        ],
        customer_email: inquiry.email,
        client_reference_id: inquiry.id,
        metadata: { inquiry_id: inquiry.id, checkout_id: checkoutId },
        payment_intent_data: { metadata: { inquiry_id: inquiry.id, checkout_id: checkoutId } },
        success_url: `${siteUrl()}/c/${token}?returned=1`,
        cancel_url: `${siteUrl()}/c/${token}?canceled=1`,
      },
      { idempotencyKey: `checkout-${checkoutId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    sessionId = session.id;
    url = session.url;
  } else {
    sessionId = `sim_${checkoutId}`;
    url = `/c/${token}/test-payment`;
  }

  await db.run("INSERT INTO checkouts(id, inquiry_id, provider, provider_session_id, status, amount_cents, currency, url, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", checkoutId, inquiry.id, provider, sessionId, "open", offer.priceCents, offer.currency, url, now, now);
  await track("checkout_started", { subject: checkoutId, isTest: Boolean(inquiry.is_test) });
  return { redirectTo: url };
}

/** The authorized card hold for an inquiry, if one is waiting to be charged or released. */
export async function activeHold(inquiryId: string) {
  return await db.get("SELECT * FROM checkouts WHERE inquiry_id = ? AND purpose = 'hold' AND status = 'authorized' ORDER BY created_at DESC LIMIT 1", inquiryId) as
    | CheckoutRow
    | undefined;
}

/**
 * Start a card hold for a request that is waiting for review. Called right
 * after the request form is saved. Returns the Stripe page to send the
 * customer to. The success page proves nothing; only the webhook marks the
 * hold as authorized.
 */
export async function startHold(inquiryId: string): Promise<{ redirectTo: string }> {
  if (!holdsEnabled()) throw new CheckoutUnavailable("holds_disabled");
  const inquiry = await db.get("SELECT * FROM inquiries WHERE id = ?", inquiryId) as InquiryRow | undefined;
  if (!inquiry || inquiry.status !== "pending_review") throw new CheckoutUnavailable("not_pending");

  const checkoutId = newId();
  const now = nowIso();
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: offer.currency,
            unit_amount: offer.priceCents,
            product_data: {
              name: offer.productName,
              description: `Card hold only. You're charged only if we approve your home; otherwise the hold is released. ${offer.serviceDays}-day service window, final report, and day-${offer.recheckDay} recheck.`,
            },
          },
        },
      ],
      customer_email: inquiry.email,
      client_reference_id: inquiry.id,
      metadata: { inquiry_id: inquiry.id, checkout_id: checkoutId, purpose: "hold" },
      payment_intent_data: {
        capture_method: "manual",
        metadata: { inquiry_id: inquiry.id, checkout_id: checkoutId, purpose: "hold" },
      },
      success_url: `${siteUrl()}/start/held`,
      cancel_url: `${siteUrl()}/start/held?skipped=1`,
    },
    { idempotencyKey: `hold-${checkoutId}` },
  );
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await db.run("INSERT INTO checkouts(id, inquiry_id, provider, provider_session_id, status, amount_cents, currency, url, purpose, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", checkoutId, inquiry.id, "stripe", session.id, "open", offer.priceCents, offer.currency, session.url, "hold", now, now);
  await track("checkout_started", { subject: checkoutId, isTest: Boolean(inquiry.is_test) });
  return { redirectTo: session.url };
}

function stripeErrorCode(err: unknown) {
  return (err as { code?: string } | null)?.code;
}

/** Cancel a hold's PaymentIntent. A hold Stripe already canceled (for example, expired) counts as released. */
async function releaseHold(hold: CheckoutRow) {
  if (hold.payment_intent) {
    try {
      await stripe().paymentIntents.cancel(hold.payment_intent, {}, { idempotencyKey: `release-${hold.id}` });
    } catch (err) {
      if (stripeErrorCode(err) !== "payment_intent_unexpected_state") throw err;
    }
  }
  await db.run("UPDATE checkouts SET status='released', updated_at=? WHERE id=?", nowIso(), hold.id);
}

/**
 * Approve a request. With an authorized hold, the hold is charged and the
 * customer goes straight to onboarding. Without one (or if the hold expired),
 * the customer is emailed a payment link as before.
 */
export async function approveRequest(idOrRef: string, decidedBy: string, note?: string) {
  const found = await findInquiry(idOrRef);
  if (!found) throw new Error("Inquiry not found");
  const hold = found.status === "pending_review" || found.status === "approved" ? await activeHold(found.id) : undefined;
  if (!hold || !hold.payment_intent) {
    const r = await approveInquiry(found.id, decidedBy, note);
    return { ...r, charged: false as const, holdExpired: false };
  }

  let captured: Stripe.PaymentIntent;
  try {
    captured = await stripe().paymentIntents.capture(hold.payment_intent, {}, { idempotencyKey: `capture-${hold.id}` });
  } catch (err) {
    // Expired or already canceled: release it on our side and fall back to a payment link.
    if (stripeErrorCode(err) !== "payment_intent_unexpected_state") throw err;
    await db.run("UPDATE checkouts SET status='released', updated_at=? WHERE id=?", nowIso(), hold.id);
    const r = await approveInquiry(found.id, decidedBy, note);
    return { ...r, charged: false as const, holdExpired: true };
  }
  if (captured.status !== "succeeded") throw new Error(`Hold capture returned ${captured.status}; check Stripe before retrying`);

  const r = await approveInquiry(found.id, decidedBy, note, { notify: false });
  const result = await confirmPayment({
    sessionId: hold.provider_session_id,
    amountCents: captured.amount_received,
    currency: captured.currency,
    paymentRef: captured.id,
    fromHold: true,
  });
  if ("error" in result) throw new Error(`Charged in Stripe but not recorded (${result.error}); check the order before retrying`);
  return { ...r, charged: true as const, holdExpired: false, orderNumber: result.order.order_number };
}

/** Decline a request, releasing any card hold first so the email can say so truthfully. */
export async function declineRequest(idOrRef: string, decidedBy: string, reason: DeclineReason, note?: string) {
  const found = await findInquiry(idOrRef);
  if (!found) throw new Error("Inquiry not found");
  const hold = found.status !== "paid" ? await activeHold(found.id) : undefined;
  if (hold) await releaseHold(hold);
  return await declineInquiry(found.id, decidedBy, reason, note, { holdReleased: Boolean(hold) });
}

/** Delete an unpaid request, releasing any card hold first. */
export async function deleteRequest(idOrRef: string) {
  const found = await findInquiry(idOrRef);
  if (!found) return false;
  if (found.status !== "paid") {
    const hold = await activeHold(found.id);
    if (hold) await releaseHold(hold);
  }
  return await deleteInquiry(found.id);
}

async function setCheckoutStatus(sessionId: string, status: CheckoutRow["status"]) {
  await db.run("UPDATE checkouts SET status=?, updated_at=? WHERE provider_session_id=? AND status IN ('open','processing')", status, nowIso(), sessionId);
}

/**
 * Turn a verified payment into an order. Safe to call any number of times.
 * Returns the order and whether this call created it.
 */
export async function confirmPayment(input: {
  sessionId: string;
  amountCents: number | null;
  currency: string | null;
  paymentRef?: string | null;
  /** The charge came from capturing a card hold at approval time. */
  fromHold?: boolean;
}): Promise<{ order: OrderRow; created: boolean } | { error: string }> {
  const checkout = await db.get("SELECT * FROM checkouts WHERE provider_session_id = ?", input.sessionId) as
    | CheckoutRow
    | undefined;
  if (!checkout) return { error: "unknown_checkout" };
  if (input.amountCents !== checkout.amount_cents || (input.currency ?? "").toLowerCase() !== checkout.currency) {
    console.error(`[payments] amount mismatch on checkout ${checkout.id}`);
    return { error: "amount_mismatch" };
  }

  let orderToken: string | undefined;
  let result: { order: OrderRow; created: boolean };
  try {
    result = await tx(async (q) => {
    const existing = await q.get("SELECT * FROM orders WHERE inquiry_id = ?", checkout.inquiry_id) as
      | OrderRow
      | undefined;
    if (existing) return { order: existing, created: false };

    const inquiry = await q.get("SELECT * FROM inquiries WHERE id = ?", checkout.inquiry_id) as InquiryRow;
    const now = nowIso();
    const id = newId();
    orderToken = newAccessToken();
    await q.run(`INSERT INTO orders(id, order_number, inquiry_id, checkout_id, provider, provider_payment_ref, access_token_hash,
          amount_cents, currency, is_test, status, paid_at, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
        id,
        newRefCode("ORD"),
        inquiry.id,
        checkout.id,
        checkout.provider,
        input.paymentRef ?? null,
        hashToken(orderToken),
        checkout.amount_cents,
        checkout.currency,
        inquiry.is_test,
        "awaiting_intake",
        now,
        now,
        now,
      );
    await q.run("UPDATE checkouts SET status='completed', updated_at=? WHERE id=?", now, checkout.id);
    await q.run("UPDATE inquiries SET status='paid', updated_at=? WHERE id=?", now, inquiry.id);
    const order = await q.get("SELECT * FROM orders WHERE id = ?", id) as OrderRow;
    return { order, created: true };
  });
  } catch (err) {
    // A concurrent confirmation for the same inquiry won the race: use its order.
    const existing = await db.get<OrderRow>("SELECT * FROM orders WHERE inquiry_id = ?", checkout.inquiry_id);
    if (!existing) throw err;
    orderToken = undefined;
    result = { order: existing, created: false };
  }


  if (result.created && orderToken) {
    const inquiry = await db.get("SELECT * FROM inquiries WHERE id = ?", result.order.inquiry_id) as InquiryRow;
    await track("purchase_confirmed", { subject: result.order.id, isTest: Boolean(result.order.is_test) });
    await sendEmail({
      template: "payment_confirmed",
      to: inquiry.email,
      subject: input.fromHold
        ? `Your home qualifies: next step (${result.order.order_number})`
        : `Payment received: next step for your home (${result.order.order_number})`,
      relatedId: inquiry.id,
      paragraphs: [
        `Hi ${firstName(inquiry.name)},`,
        input.fromHold
          ? `We reviewed ${addressLine(inquiry)} and it qualifies. We've charged the ${formatMoney(result.order.amount_cents)} hold you placed on your card. Thank you.`
          : `We received your payment of ${formatMoney(result.order.amount_cents)} for ${addressLine(inquiry)}. Thank you.`,
        "One step is left before we start: a short onboarding form with your written authorization for us to act on your behalf. It takes a few minutes.",
        `Your ${offer.serviceDays}-day service window starts when the form is complete.`,
        `Order number: ${result.order.order_number}`,
      ],
      button: { label: "Finish onboarding", url: customerLink(orderToken) },
    });
    await notifyOperator(`Payment confirmed ${result.order.order_number}`, [
      `Order ${result.order.order_number} was paid and is waiting for customer onboarding.`,
    ]);
  }
  return result;
}

/**
 * A hold checkout finished. Mark it authorized only after Stripe confirms the
 * PaymentIntent is waiting for capture for the full amount.
 */
async function recordHold(checkout: CheckoutRow, paymentRef: string | undefined) {
  if (!paymentRef) {
    await setCheckoutStatus(checkout.provider_session_id, "processing");
    return;
  }
  const intent = await stripe().paymentIntents.retrieve(paymentRef);
  const inquiry = await db.get("SELECT status FROM inquiries WHERE id = ?", checkout.inquiry_id) as { status: string } | undefined;
  if (intent.status === "requires_capture" && inquiry?.status !== "pending_review") {
    // The request was already decided (or a payment link was used) before this hold finished. Don't hold money for nothing.
    await db.run("UPDATE checkouts SET payment_intent=?, updated_at=? WHERE id=?", intent.id, nowIso(), checkout.id);
    await releaseHold({ ...checkout, payment_intent: intent.id });
    return;
  }
  if (intent.status === "requires_capture" && intent.amount_capturable === checkout.amount_cents && intent.currency === checkout.currency) {
    const now = nowIso();
    await db.run("UPDATE checkouts SET status='authorized', payment_intent=?, authorized_at=?, updated_at=? WHERE id=? AND status IN ('open','processing')", intent.id, now, now, checkout.id);
  } else if (intent.status === "canceled") {
    await setCheckoutStatus(checkout.provider_session_id, "failed");
  } else {
    await db.run("UPDATE checkouts SET status='processing', payment_intent=?, updated_at=? WHERE id=? AND status='open'", intent.id, nowIso(), checkout.id);
  }
}

/** Verify and process a Stripe webhook. Throws on a bad signature. */
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const { webhookSecret } = stripeKeys();
  if (!webhookSecret) throw new Error("Webhook secret not configured");
  if (!signature) throw new Error("Missing signature");
  const event = stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);

  const seen = await db.get("SELECT 1 FROM webhook_events WHERE id = ?", event.id);
  if (seen) return { duplicate: true, type: event.type };

  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentRef = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const checkout = await db.get("SELECT * FROM checkouts WHERE provider_session_id = ?", session.id) as CheckoutRow | undefined;
    switch (event.type) {
      case "checkout.session.completed":
        if (checkout?.purpose === "hold") {
          await recordHold(checkout, paymentRef);
        } else if (!checkout && session.metadata?.purpose === "hold" && paymentRef) {
          // The request was deleted before the hold finished: release it.
          try {
            await stripe().paymentIntents.cancel(paymentRef);
          } catch (err) {
            if (stripeErrorCode(err) !== "payment_intent_unexpected_state") throw err;
          }
        } else if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
          await confirmPayment({
            sessionId: session.id,
            amountCents: session.amount_total,
            currency: session.currency,
            paymentRef,
          });
        } else {
          await setCheckoutStatus(session.id, "processing");
        }
        break;
      case "checkout.session.async_payment_succeeded":
        await confirmPayment({ sessionId: session.id, amountCents: session.amount_total, currency: session.currency, paymentRef });
        break;
      case "checkout.session.async_payment_failed":
        await setCheckoutStatus(session.id, "failed");
        break;
      case "checkout.session.expired":
        await setCheckoutStatus(session.id, "expired");
        break;
    }
  } else if (event.type === "payment_intent.canceled") {
    // A hold expired or was canceled in the Stripe dashboard.
    const intent = event.data.object as Stripe.PaymentIntent;
    await db.run("UPDATE checkouts SET status='released', updated_at=? WHERE payment_intent=? AND purpose='hold' AND status='authorized'", nowIso(), intent.id);
  }

  // Recorded only after successful processing, so a failure lets Stripe retry.
  await db.run("INSERT OR IGNORE INTO webhook_events(id, type, received_at) VALUES(?,?,?)", event.id, event.type, nowIso());
  return { duplicate: false, type: event.type };
}

/** Preview-only stand-in for Stripe so the whole flow can be tried without keys. */
export async function completeSimulatedPayment(token: string, outcome: "pay" | "cancel" | "decline") {
  if (paymentProvider() !== "simulated") throw new CheckoutUnavailable("simulation_disabled");
  const found = await customerByToken(token);
  if (!found) throw new CheckoutUnavailable("not_found");
  const checkout = await latestCheckout(found.inquiry.id);
  if (!checkout || checkout.provider !== "simulated") throw new CheckoutUnavailable("no_checkout");
  if (outcome === "cancel") {
    await setCheckoutStatus(checkout.provider_session_id, "canceled");
    return { status: "canceled" as const };
  }
  if (outcome === "decline") {
    await setCheckoutStatus(checkout.provider_session_id, "failed");
    return { status: "failed" as const };
  }
  if (checkout.status !== "open" && checkout.status !== "completed") throw new CheckoutUnavailable("checkout_closed");
  const result = await confirmPayment({
    sessionId: checkout.provider_session_id,
    amountCents: checkout.amount_cents,
    currency: checkout.currency,
    paymentRef: `sim_pay_${checkout.id}`,
  });
  if ("error" in result) throw new Error(result.error);
  return { status: "paid" as const };
}

/** Record a refund. For Stripe payments, the refund is issued through Stripe first. */
export async function refundOrder(orderNumberOrId: string, reason: string) {
  const order = await db.get("SELECT * FROM orders WHERE id = ? OR order_number = ?", orderNumberOrId, orderNumberOrId.toUpperCase()) as OrderRow | undefined;
  if (!order) throw new Error("Order not found");
  if (order.status === "refunded") return order;
  if (order.provider === "stripe") {
    if (!order.provider_payment_ref) throw new Error("No Stripe payment reference; refund in the Stripe dashboard");
    await stripe().refunds.create(
      { payment_intent: order.provider_payment_ref, metadata: { order_id: order.id } },
      { idempotencyKey: `refund-${order.id}` },
    );
  }
  const now = nowIso();
  await db.run("UPDATE orders SET status='refunded', refunded_at=?, refund_reason=?, updated_at=? WHERE id=?", now, reason, now, order.id);
  return await db.get("SELECT * FROM orders WHERE id = ?", order.id) as OrderRow;
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
