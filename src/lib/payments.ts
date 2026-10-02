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
export function customerByToken(token: string): { inquiry: InquiryRow; order?: OrderRow } | undefined {
  const inquiry = inquiryByToken(token);
  if (inquiry) {
    const order = db().prepare("SELECT * FROM orders WHERE inquiry_id = ?").get(inquiry.id) as OrderRow | undefined;
    return { inquiry, order };
  }
  const order = db().prepare("SELECT * FROM orders WHERE access_token_hash = ?").get(hashToken(token)) as
    | OrderRow
    | undefined;
  if (!order) return undefined;
  const inq = db().prepare("SELECT * FROM inquiries WHERE id = ?").get(order.inquiry_id) as InquiryRow;
  return { inquiry: inq, order };
}

export function latestCheckout(inquiryId: string) {
  return db()
    .prepare("SELECT * FROM checkouts WHERE inquiry_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(inquiryId) as CheckoutRow | undefined;
}

/** Create (or reuse) a checkout for an approved inquiry and return where to send the customer. */
export async function startCheckout(token: string): Promise<{ redirectTo: string }> {
  const found = customerByToken(token);
  if (!found) throw new CheckoutUnavailable("not_found");
  const { inquiry, order } = found;
  if (order || inquiry.status === "paid") return { redirectTo: `/c/${token}` };
  if (inquiry.status !== "approved") throw new CheckoutUnavailable("not_approved");

  const provider = paymentProvider();
  if (provider === "none") throw new CheckoutUnavailable("ordering_closed");

  // Reuse a recent open session instead of creating duplicates on double-clicks.
  const existing = latestCheckout(inquiry.id);
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

  db()
    .prepare(
      "INSERT INTO checkouts(id, inquiry_id, provider, provider_session_id, status, amount_cents, currency, url, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .run(checkoutId, inquiry.id, provider, sessionId, "open", offer.priceCents, offer.currency, url, now, now);
  track("checkout_started", { subject: checkoutId, isTest: Boolean(inquiry.is_test) });
  return { redirectTo: url };
}

function setCheckoutStatus(sessionId: string, status: CheckoutRow["status"]) {
  db()
    .prepare("UPDATE checkouts SET status=?, updated_at=? WHERE provider_session_id=? AND status IN ('open','processing')")
    .run(status, nowIso(), sessionId);
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
  const checkout = db().prepare("SELECT * FROM checkouts WHERE provider_session_id = ?").get(input.sessionId) as
    | CheckoutRow
    | undefined;
  if (!checkout) return { error: "unknown_checkout" };
  if (input.amountCents !== checkout.amount_cents || (input.currency ?? "").toLowerCase() !== checkout.currency) {
    console.error(`[payments] amount mismatch on checkout ${checkout.id}`);
    return { error: "amount_mismatch" };
  }

  let orderToken: string | undefined;
  const result = tx(() => {
    const existing = db().prepare("SELECT * FROM orders WHERE inquiry_id = ?").get(checkout.inquiry_id) as
      | OrderRow
      | undefined;
    if (existing) return { order: existing, created: false };

    const inquiry = db().prepare("SELECT * FROM inquiries WHERE id = ?").get(checkout.inquiry_id) as InquiryRow;
    const now = nowIso();
    const id = newId();
    orderToken = newAccessToken();
    db()
      .prepare(
        `INSERT INTO orders(id, order_number, inquiry_id, checkout_id, provider, provider_payment_ref, access_token_hash,
          amount_cents, currency, is_test, status, paid_at, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
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
    db().prepare("UPDATE checkouts SET status='completed', updated_at=? WHERE id=?").run(now, checkout.id);
    db().prepare("UPDATE inquiries SET status='paid', updated_at=? WHERE id=?").run(now, inquiry.id);
    const order = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
    return { order, created: true };
  });

  if (result.created && orderToken) {
    const inquiry = db().prepare("SELECT * FROM inquiries WHERE id = ?").get(result.order.inquiry_id) as InquiryRow;
    track("purchase_confirmed", { subject: result.order.id, isTest: Boolean(result.order.is_test) });
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

  const seen = db().prepare("SELECT 1 FROM webhook_events WHERE id = ?").get(event.id);
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
          setCheckoutStatus(session.id, "processing");
        }
        break;
      case "checkout.session.async_payment_succeeded":
        await confirmPayment({ sessionId: session.id, amountCents: session.amount_total, currency: session.currency, paymentRef });
        break;
      case "checkout.session.async_payment_failed":
        setCheckoutStatus(session.id, "failed");
        break;
      case "checkout.session.expired":
        setCheckoutStatus(session.id, "expired");
        break;
    }
  }

  // Recorded only after successful processing, so a failure lets Stripe retry.
  db().prepare("INSERT OR IGNORE INTO webhook_events(id, type, received_at) VALUES(?,?,?)").run(event.id, event.type, nowIso());
  return { duplicate: false, type: event.type };
}

/** Preview-only stand-in for Stripe so the whole flow can be tried without keys. */
export async function completeSimulatedPayment(token: string, outcome: "pay" | "cancel" | "decline") {
  if (paymentProvider() !== "simulated") throw new CheckoutUnavailable("simulation_disabled");
  const found = customerByToken(token);
  if (!found) throw new CheckoutUnavailable("not_found");
  const checkout = latestCheckout(found.inquiry.id);
  if (!checkout || checkout.provider !== "simulated") throw new CheckoutUnavailable("no_checkout");
  if (outcome === "cancel") {
    setCheckoutStatus(checkout.provider_session_id, "canceled");
    return { status: "canceled" as const };
  }
  if (outcome === "decline") {
    setCheckoutStatus(checkout.provider_session_id, "failed");
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
  const order = db()
    .prepare("SELECT * FROM orders WHERE id = ? OR order_number = ?")
    .get(orderNumberOrId, orderNumberOrId.toUpperCase()) as OrderRow | undefined;
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
  db().prepare("UPDATE orders SET status='refunded', refunded_at=?, refund_reason=?, updated_at=? WHERE id=?").run(now, reason, now, order.id);
  return db().prepare("SELECT * FROM orders WHERE id = ?").get(order.id) as OrderRow;
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
