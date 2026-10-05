import "server-only";
import Stripe from "stripe";
import { db, nowIso, tx } from "./db";
import { hashToken, newAccessToken, newId, newRefCode } from "./tokens";
import { addressLine, customerLink, firstName, inquiryByToken, type InquiryRow } from "./eligibility";
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
 */

export type CheckoutRow = {
  id: string;
  inquiry_id: string;
  provider: "stripe" | "simulated";
  provider_session_id: string;
  status: "open" | "processing" | "completed" | "expired" | "canceled" | "failed";
  amount_cents: number;
  currency: string;
  url: string | null;
  created_at: string;
};

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

  // Reuse a recent open session instead of creating duplicates on double-clicks.
  const existing = await latestCheckout(inquiry.id);
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
      subject: `Payment received: next step for your home (${result.order.order_number})`,
      relatedId: inquiry.id,
      paragraphs: [
        `Hi ${firstName(inquiry.name)},`,
        `We received your payment of ${formatMoney(result.order.amount_cents)} for ${addressLine(inquiry)}. Thank you.`,
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
    switch (event.type) {
      case "checkout.session.completed":
        if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
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
