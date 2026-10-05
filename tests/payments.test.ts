import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { freshDb, setEnv, silenceConsole, VALID_INQUIRY } from "./helpers";
import { approveInquiry, submitInquiry } from "@/lib/eligibility";
import { eligibilitySchema } from "@/lib/validation";
import {
  CheckoutUnavailable,
  completeSimulatedPayment,
  customerByToken,
  latestCheckout,
  startCheckout,
  stripe,
} from "@/lib/payments";
import { handleStripeWebhookRequest } from "@/lib/handlers";
import { db } from "@/lib/db";

const WHSEC = "whsec_test_secret";

async function approvedToken() {
  const { refCode } = await submitInquiry(eligibilitySchema.parse(VALID_INQUIRY));
  const { token } = await approveInquiry(refCode, "op");
  return token;
}

const count = async (sql: string) => ((await db.get(sql)) as { n: number }).n;

beforeEach(() => {
  setEnv();
  freshDb();
  vi.restoreAllMocks();
});

describe("preview simulated checkout", () => {
  it("creates exactly one order no matter how many times payment is confirmed", async () => {
    const token = await approvedToken();
    const { redirectTo } = await startCheckout(token);
    expect(redirectTo).toBe(`/c/${token}/test-payment`);
    expect((await customerByToken(token))?.order).toBeUndefined();

    await completeSimulatedPayment(token, "pay");
    await completeSimulatedPayment(token, "pay");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM funnel_events WHERE name='purchase_confirmed'")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='payment_confirmed'")).toBe(1);

    const order = (await customerByToken(token))!.order!;
    expect(order.amount_cents).toBe(49900);
    expect(order.status).toBe("awaiting_intake");
    expect(order.service_ends_at).toBeNull(); // clock starts at completed intake, not payment
    // A paid customer going back to checkout is sent to their order page.
    expect((await startCheckout(token)).redirectTo).toBe(`/c/${token}`);
  });

  it("handles a canceled checkout without creating an order and allows a retry", async () => {
    const token = await approvedToken();
    await startCheckout(token);
    expect((await completeSimulatedPayment(token, "cancel")).status).toBe("canceled");
    expect((await latestCheckout((await customerByToken(token))!.inquiry.id))?.status).toBe("canceled");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);

    await startCheckout(token);
    await completeSimulatedPayment(token, "pay");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(1);
  });

  it("handles a declined card without creating an order", async () => {
    const token = await approvedToken();
    await startCheckout(token);
    expect((await completeSimulatedPayment(token, "decline")).status).toBe("failed");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });

  it("refuses checkout for requests that are not approved", async () => {
    const { refCode } = await submitInquiry(eligibilitySchema.parse(VALID_INQUIRY));
    expect(refCode).toBeTruthy();
    await expect(startCheckout("x".repeat(43))).rejects.toBeInstanceOf(CheckoutUnavailable);
  });

  it("issuing a new link invalidates the old one", async () => {
    const { refCode } = await submitInquiry(eligibilitySchema.parse(VALID_INQUIRY));
    const first = await approveInquiry(refCode, "op");
    const second = await approveInquiry(refCode, "op");
    expect(await customerByToken(first.token)).toBeUndefined();
    expect(await customerByToken(second.token)).toBeDefined();
  });
});

describe("Stripe checkout and webhooks", () => {
  function useStripe() {
    setEnv({ STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: WHSEC });
    const create = vi
      .spyOn(stripe().checkout.sessions, "create")
      .mockImplementation(async () => ({ id: `cs_test_${create.mock.calls.length}`, url: "https://checkout.stripe.com/c/pay/test" }) as never);
    return create;
  }

  function signed(event: object) {
    const payload = JSON.stringify(event);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
    return new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header, "content-type": "application/json" },
      body: payload,
    });
  }

  function sessionEvent(id: string, type: string, session: Record<string, unknown>) {
    return { id, object: "event", type, data: { object: { object: "checkout.session", amount_total: 49900, currency: "usd", payment_status: "paid", payment_intent: "pi_123", ...session } } };
  }

  it("prices on the server, reuses an open session, and treats the redirect as unconfirmed", async () => {
    const create = useStripe();
    const token = await approvedToken();
    const a = await startCheckout(token);
    const b = await startCheckout(token);
    expect(a.redirectTo).toBe("https://checkout.stripe.com/c/pay/test");
    expect(b.redirectTo).toBe(a.redirectTo);
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(49900);
    expect(params.success_url).toContain(`/c/${token}?returned=1`);
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });

  it("creates one order from a verified webhook and ignores duplicates", async () => {
    useStripe();
    const token = await approvedToken();
    await startCheckout(token);
    const sid = (await latestCheckout((await customerByToken(token))!.inquiry.id))!.provider_session_id;

    const ev = sessionEvent("evt_1", "checkout.session.completed", { id: sid });
    const r1 = await handleStripeWebhookRequest(signed(ev));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ received: true, duplicate: false });

    const r2 = await handleStripeWebhookRequest(signed(ev));
    expect(await r2.json()).toEqual({ received: true, duplicate: true });

    // A different event for the same session (e.g. async success after completion) still yields one order.
    await handleStripeWebhookRequest(signed(sessionEvent("evt_2", "checkout.session.async_payment_succeeded", { id: sid })));

    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM funnel_events WHERE name='purchase_confirmed'")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='payment_confirmed'")).toBe(1);
    expect((await customerByToken(token))!.order!.provider_payment_ref).toBe("pi_123");
  });

  it("rejects bad signatures without creating anything", async () => {
    silenceConsole();
    useStripe();
    const token = await approvedToken();
    await startCheckout(token);
    const sid = (await latestCheckout((await customerByToken(token))!.inquiry.id))!.provider_session_id;
    const payload = JSON.stringify(sessionEvent("evt_x", "checkout.session.completed", { id: sid }));
    const forged = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" }) },
      body: payload,
    });
    expect((await handleStripeWebhookRequest(forged)).status).toBe(400);
    const unsigned = new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload });
    expect((await handleStripeWebhookRequest(unsigned)).status).toBe(400);
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });

  it("does not create an order when the paid amount doesn't match", async () => {
    silenceConsole();
    useStripe();
    const token = await approvedToken();
    await startCheckout(token);
    const sid = (await latestCheckout((await customerByToken(token))!.inquiry.id))!.provider_session_id;
    await handleStripeWebhookRequest(signed(sessionEvent("evt_3", "checkout.session.completed", { id: sid, amount_total: 100 })));
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });

  it("waits for delayed payments, and records failed and expired sessions", async () => {
    useStripe();
    const token = await approvedToken();
    await startCheckout(token);
    const inquiryId = (await customerByToken(token))!.inquiry.id;
    const sid = (await latestCheckout(inquiryId))!.provider_session_id;

    await handleStripeWebhookRequest(signed(sessionEvent("evt_4", "checkout.session.completed", { id: sid, payment_status: "unpaid" })));
    expect((await latestCheckout(inquiryId))!.status).toBe("processing");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);

    await handleStripeWebhookRequest(signed(sessionEvent("evt_5", "checkout.session.async_payment_failed", { id: sid, payment_status: "unpaid" })));
    expect((await latestCheckout(inquiryId))!.status).toBe("failed");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);

    // Customer tries again; the new session expires unused.
    await startCheckout(token);
    const sid2 = (await latestCheckout(inquiryId))!.provider_session_id;
    expect(sid2).not.toBe(sid);
    await handleStripeWebhookRequest(signed(sessionEvent("evt_6", "checkout.session.expired", { id: sid2, payment_status: "unpaid" })));
    expect((await latestCheckout(inquiryId))!.status).toBe("expired");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });

  it("ignores webhooks for sessions it didn't create", async () => {
    useStripe();
    const r = await handleStripeWebhookRequest(signed(sessionEvent("evt_7", "checkout.session.completed", { id: "cs_unknown" })));
    expect(r.status).toBe(200);
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
  });
});
