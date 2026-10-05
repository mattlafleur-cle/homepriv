import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, jsonRequest, oldFormToken, PII, setEnv, VALID_INQUIRY } from "./helpers";
import { handleAgentInquiry, handleEligibility, handleEvent, handleOnboarding } from "@/lib/handlers";
import { approveInquiry } from "@/lib/eligibility";
import { completeSimulatedPayment, customerByToken, startCheckout } from "@/lib/payments";
import { db } from "@/lib/db";
import { purgeExpired } from "@/lib/retention";

beforeEach(() => {
  setEnv();
  freshDb();
});

async function paidToken() {
  const res = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: oldFormToken() }));
  const { refCode } = await res.json();
  const { token } = await approveInquiry(refCode, "op");
  await startCheckout(token);
  await completeSimulatedPayment(token, "pay");
  return token;
}

describe("funnel events", () => {
  it("accepts only allowlisted client events and stores no extra fields", async () => {
    await handleEvent(jsonRequest("/api/event", { name: "cta_primary_click", location: "hero", email: "pat@example.com" }));
    await handleEvent(jsonRequest("/api/event", { name: "purchase_confirmed" })); // server-only event
    await handleEvent(jsonRequest("/api/event", { name: "eligibility_started", location: "somewhere-else" }));
    await handleEvent(jsonRequest("/api/event", { name: "<script>" }));
    const rows = (await db.all("SELECT name, location FROM funnel_events ORDER BY id"));
    expect(rows).toEqual([
      { name: "cta_primary_click", location: "hero" },
      { name: "eligibility_started", location: null },
    ]);
  });

  it("never records personal information anywhere in the funnel table", async () => {
    await paidToken();
    const dump = JSON.stringify((await db.all("SELECT * FROM funnel_events")));
    for (const p of PII) expect(dump).not.toContain(p);
    const names = ((await db.all("SELECT name FROM funnel_events ORDER BY id")) as { name: string }[]).map((r) => r.name);
    expect(names).toEqual(["eligibility_submitted", "eligibility_approved", "checkout_started", "purchase_confirmed"]);
  });

  it("does not log personal information when saving fails", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    await db.exec("DROP TABLE inquiries");
    const res = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: oldFormToken() }));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("wasn't saved");
    for (const p of PII) {
      expect(body).not.toContain(p);
      expect(errors.join("\n")).not.toContain(p);
    }
  });
});

describe("onboarding after payment", () => {
  it("records authorization, starts the clock, keeps Street View opt-in off by default, and can't run twice", async () => {
    const token = await paidToken();
    const missing = await handleOnboarding(jsonRequest("/api/onboarding", { token, authorizationName: "" }));
    expect(missing.status).toBe(422);
    expect(Object.keys((await missing.json()).fieldErrors).sort()).toEqual(["authorizationConfirmed", "authorizationName"]);

    const ok = await handleOnboarding(jsonRequest("/api/onboarding", { token, authorizationName: "Pat Example", authorizationConfirmed: true }));
    expect(ok.status).toBe(200);
    const okText = await ok.text();
    for (const p of PII) expect(okText).not.toContain(p);

    const order = (await customerByToken(token))!.order!;
    expect(order.status).toBe("in_service");
    expect(order.street_view_consent).toBe(0);
    const days = (Date.parse(order.service_ends_at!) - Date.parse(order.intake_completed_at!)) / 86_400_000;
    const recheck = (Date.parse(order.recheck_at!) - Date.parse(order.intake_completed_at!)) / 86_400_000;
    expect(days).toBe(45);
    expect(recheck).toBe(60);

    const again = await handleOnboarding(jsonRequest("/api/onboarding", { token, authorizationName: "Pat Example", authorizationConfirmed: true }));
    expect(again.status).toBe(409);
  });

  it("rejects unknown tokens", async () => {
    const res = await handleOnboarding(jsonRequest("/api/onboarding", { token: "a".repeat(43), authorizationName: "X Y", authorizationConfirmed: true }));
    expect(res.status).toBe(404);
  });

  it("the order link emailed after payment also works, and raw tokens are never stored", async () => {
    const token = await paidToken();
    const mail = (await db.get("SELECT text FROM email_outbox WHERE template='payment_confirmed'")) as { text: string };
    const orderToken = mail.text.match(/\/c\/([A-Za-z0-9_-]{43})/)![1];
    expect(orderToken).not.toBe(token);
    expect((await customerByToken(orderToken))?.order).toBeDefined();
    const dump = JSON.stringify([(await db.all("SELECT * FROM inquiries")), (await db.all("SELECT * FROM orders"))]);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(orderToken);
  });
});

describe("agent inquiries and retention", () => {
  it("stores an agent inquiry without echoing it back", async () => {
    const res = await handleAgentInquiry(
      jsonRequest("/api/agent-inquiry", { name: "Alex Agent", email: "alex@example.com", contactConsent: true, formToken: oldFormToken() }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await db.get("SELECT COUNT(*) n FROM agent_inquiries"))).toEqual({ n: 1 });
  });

  it("purges expired declined requests but keeps paid orders", async () => {
    await paidToken();
    const res = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, listingStatus: "listed", formToken: oldFormToken() }));
    expect(res.status).toBe(200);
    (await db.run("UPDATE inquiries SET updated_at = '2000-01-01T00:00:00.000Z'"));
    const r = await purgeExpired();
    expect(r.inquiries).toBe(1);
    expect((await db.all("SELECT status FROM inquiries"))).toEqual([{ status: "paid" }]);
  });
});
