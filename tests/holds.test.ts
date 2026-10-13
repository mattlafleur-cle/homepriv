import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { freshDb, jsonRequest, oldFormToken, PII, setEnv, VALID_INQUIRY } from "./helpers";
import { findInquiry } from "@/lib/eligibility";
import { approveRequest, declineRequest, deleteRequest, latestCheckout, startCheckout, stripe } from "@/lib/payments";
import { handleEligibility, handleStripeWebhookRequest } from "@/lib/handlers";
import { db } from "@/lib/db";

const WHSEC = "whsec_test_secret";
const count = async (sql: string) => ((await db.get(sql)) as { n: number }).n;

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

const completed = (id: string, sessionId: string, extra: Record<string, unknown> = {}) => ({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: { object: { object: "checkout.session", id: sessionId, amount_total: 34900, currency: "usd", payment_status: "unpaid", payment_intent: "pi_hold", ...extra } },
});

const unexpectedState = () => Object.assign(new Error("This PaymentIntent could not be captured"), { code: "payment_intent_unexpected_state" });

let sessions = 0;
function useStripe(intent: Partial<Stripe.PaymentIntent> = {}) {
  setEnv({ STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: WHSEC });
  const s = stripe();
  const create = vi.spyOn(s.checkout.sessions, "create").mockImplementation(async () => {
    sessions += 1;
    return { id: `cs_test_${sessions}`, url: `https://checkout.stripe.com/c/pay/test_${sessions}` } as never;
  });
  const retrieve = vi.spyOn(s.paymentIntents, "retrieve").mockImplementation(
    async () => ({ id: "pi_hold", status: "requires_capture", amount_capturable: 34900, currency: "usd", ...intent }) as never,
  );
  const capture = vi.spyOn(s.paymentIntents, "capture").mockImplementation(
    async () => ({ id: "pi_hold", status: "succeeded", amount_received: 34900, currency: "usd" }) as never,
  );
  const cancel = vi.spyOn(s.paymentIntents, "cancel").mockImplementation(async () => ({ id: "pi_hold", status: "canceled" }) as never);
  return { create, retrieve, capture, cancel };
}

async function submit() {
  const res = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: oldFormToken() }));
  const body = await res.json();
  const inquiry = (await findInquiry(body.refCode))!;
  return { body, inquiry, raw: JSON.stringify(body) };
}

async function placeHold(n = 1) {
  const s = await submit();
  const hold = (await latestCheckout(s.inquiry.id))!;
  await handleStripeWebhookRequest(signed(completed(`evt_hold_${n}`, hold.provider_session_id)));
  return s;
}

beforeEach(() => {
  setEnv();
  freshDb();
  vi.restoreAllMocks();
});

describe("card holds", () => {
  it("places a manual-capture hold right after the request, and charges it only on approval", async () => {
    const { create, capture } = useStripe();
    const { body, inquiry, raw } = await submit();
    expect(body.holdUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    for (const p of PII) expect(raw).not.toContain(p);

    const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.payment_intent_data?.capture_method).toBe("manual");
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(34900);
    expect(params.success_url).toMatch(/\/start\/held$/);
    expect(params.success_url).not.toContain(inquiry.ref_code);

    // Landing on the success page proves nothing; only the webhook authorizes the hold.
    expect((await latestCheckout(inquiry.id))!.status).toBe("open");
    await handleStripeWebhookRequest(signed(completed("evt_h1", (await latestCheckout(inquiry.id))!.provider_session_id)));
    const hold = (await latestCheckout(inquiry.id))!;
    expect(hold.status).toBe("authorized");
    expect(hold.payment_intent).toBe("pi_hold");
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);

    const r = await approveRequest(inquiry.ref_code, "op");
    expect(r.charged).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe("pi_hold");
    const order = (await db.get("SELECT * FROM orders")) as { amount_cents: number; provider_payment_ref: string; status: string };
    expect(order.amount_cents).toBe(34900);
    expect(order.provider_payment_ref).toBe("pi_hold");
    expect(order.status).toBe("awaiting_intake");
    expect((await findInquiry(inquiry.ref_code))!.status).toBe("paid");
    // One onboarding email, and no separate "review and pay" link.
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='payment_confirmed' AND subject LIKE '%qualifies%'")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='approved_checkout'")).toBe(0);
  });

  it("releases the hold when a request is declined, and says so", async () => {
    const { cancel, capture } = useStripe();
    const { inquiry } = await placeHold();
    await declineRequest(inquiry.ref_code, "op", "no_exposure");
    expect(cancel).toHaveBeenCalledWith("pi_hold", {}, expect.anything());
    expect(capture).not.toHaveBeenCalled();
    expect((await latestCheckout(inquiry.id))!.status).toBe("released");
    const email = (await db.get("SELECT text FROM email_outbox WHERE template='declined'")) as { text: string };
    expect(email.text).toContain("released the hold");
  });

  it("releases the hold when an unpaid request is deleted", async () => {
    const { cancel } = useStripe();
    const { inquiry } = await placeHold();
    expect(await deleteRequest(inquiry.ref_code)).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(await findInquiry(inquiry.ref_code)).toBeUndefined();
  });

  it("falls back to a payment link when the hold has expired", async () => {
    const { capture, create } = useStripe();
    capture.mockRejectedValueOnce(unexpectedState());
    const { inquiry } = await placeHold();
    const r = await approveRequest(inquiry.ref_code, "op");
    expect(r.charged).toBe(false);
    expect(r.holdExpired).toBe(true);
    expect(await count("SELECT COUNT(*) n FROM orders")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='approved_checkout'")).toBe(1);
    expect((await latestCheckout(inquiry.id))!.status).toBe("released");

    // The payment link opens a new immediate-charge session, never the old hold page.
    await startCheckout(r.token);
    const params = create.mock.calls.at(-1)![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.payment_intent_data?.capture_method).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("doesn't charge or approve when the capture fails for another reason", async () => {
    const { capture } = useStripe();
    capture.mockRejectedValueOnce(Object.assign(new Error("network"), { code: "api_connection_error" }));
    const { inquiry } = await placeHold();
    await expect(approveRequest(inquiry.ref_code, "op")).rejects.toThrow();
    expect((await findInquiry(inquiry.ref_code))!.status).toBe("pending_review");
    expect((await latestCheckout(inquiry.id))!.status).toBe("authorized");
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template IN ('approved_checkout','payment_confirmed')")).toBe(0);
  });

  it("treats a hold as authorized only when Stripe says it is waiting for capture", async () => {
    const { capture } = useStripe({ status: "requires_payment_method", amount_capturable: 0 });
    const { inquiry } = await placeHold();
    expect((await latestCheckout(inquiry.id))!.status).toBe("processing");
    const r = await approveRequest(inquiry.ref_code, "op");
    expect(r.charged).toBe(false);
    expect(capture).not.toHaveBeenCalled();
    expect(await count("SELECT COUNT(*) n FROM email_outbox WHERE template='approved_checkout'")).toBe(1);
  });

  it("releases a hold that finishes after the request was already decided", async () => {
    const { cancel } = useStripe();
    const { inquiry } = await submit();
    await declineRequest(inquiry.ref_code, "op", "out_of_area");
    expect(cancel).not.toHaveBeenCalled(); // nothing was held yet
    await handleStripeWebhookRequest(signed(completed("evt_late", (await latestCheckout(inquiry.id))!.provider_session_id)));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect((await latestCheckout(inquiry.id))!.status).toBe("released");
  });

  it("marks a hold released when Stripe reports it expired", async () => {
    useStripe();
    const { inquiry } = await placeHold();
    await handleStripeWebhookRequest(
      signed({ id: "evt_exp", object: "event", type: "payment_intent.canceled", data: { object: { object: "payment_intent", id: "pi_hold", status: "canceled" } } }),
    );
    expect((await latestCheckout(inquiry.id))!.status).toBe("released");
  });

  it("keeps the request when the hold can't start", async () => {
    const { create } = useStripe();
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValueOnce(new Error("stripe down"));
    const { body, inquiry } = await submit();
    expect(body.ok).toBe(true);
    expect(body.holdUrl).toBeUndefined();
    expect(inquiry.status).toBe("pending_review");
  });

  it("uses no hold in the simulated preview", async () => {
    const { body } = await submit();
    expect(body.ok).toBe(true);
    expect(body.holdUrl).toBeUndefined();
  });
});
