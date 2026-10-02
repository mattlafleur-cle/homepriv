import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, jsonRequest, oldFormToken, PII, setEnv, VALID_INQUIRY } from "./helpers";
import { handleEligibility } from "@/lib/handlers";
import { approveInquiry } from "@/lib/eligibility";
import { issueFormToken } from "@/lib/guard";

beforeEach(() => {
  setEnv();
  freshDb();
});

describe("eligibility intake", () => {
  it("stores a valid request for manual review and returns only a reference", async () => {
    const res = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: oldFormToken() }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body).toMatchObject({ ok: true, outcome: "review", mode: "preview" });
    expect(body.refCode).toMatch(/^HPC-[A-Z0-9]{6}$/);
    expect(Object.keys(body).sort()).toEqual(["mode", "ok", "outcome", "refCode"]);
    for (const p of PII) expect(text).not.toContain(p);

    const { db } = await import("@/lib/db");
    const row = db().prepare("SELECT * FROM inquiries WHERE ref_code = ?").get(body.refCode) as Record<string, unknown>;
    expect(row.status).toBe("pending_review");
    expect(row.is_test).toBe(1);
    expect(row.marketing_consent).toBe(0);
    expect(row.access_token_hash).toBeNull();

    const mail = db().prepare("SELECT template, status FROM email_outbox").all();
    expect(mail).toEqual([{ template: "inquiry_received", status: "held_preview" }]);
    const ev = db().prepare("SELECT name FROM funnel_events").all();
    expect(ev).toEqual([{ name: "eligibility_submitted" }]);
  });

  it("tells actively listed homes immediately and never lets them reach payment", async () => {
    const res = await handleEligibility(
      jsonRequest("/api/eligibility", { ...VALID_INQUIRY, listingStatus: "listed", formToken: oldFormToken() }),
    );
    const body = await res.json();
    expect(body.outcome).toBe("listed");
    await expect(approveInquiry(body.refCode, "op")).rejects.toThrow(/cannot be approved/);
  });

  it("routes 'not sure' to manual review", async () => {
    const res = await handleEligibility(
      jsonRequest("/api/eligibility", { ...VALID_INQUIRY, listingStatus: "unsure", formToken: oldFormToken() }),
    );
    expect((await res.json()).outcome).toBe("review");
  });

  it("returns field-level errors for missing or invalid input and stores nothing", async () => {
    const res = await handleEligibility(
      jsonRequest("/api/eligibility", {
        ...VALID_INQUIRY,
        street: "",
        zip: "4400",
        email: "not-an-email",
        authorizationConfirmed: false,
        serviceConsent: false,
        listingLinks: "javascript:alert(1)",
        formToken: oldFormToken(),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(Object.keys(body.fieldErrors).sort()).toEqual(
      ["authorizationConfirmed", "email", "listingLinks", "serviceConsent", "street", "zip"].sort(),
    );
    const { db } = await import("@/lib/db");
    expect(db().prepare("SELECT COUNT(*) n FROM inquiries").get()).toEqual({ n: 0 });
  });

  it("accepts a corrected resubmission after a validation failure", async () => {
    const token = oldFormToken();
    const bad = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, email: "nope", formToken: token }));
    expect(bad.status).toBe(422);
    const good = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: token }));
    expect(good.status).toBe(200);
  });

  it("rejects honeypot, instant, forged, and malformed submissions", async () => {
    const honey = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, website: "spam", formToken: oldFormToken() }));
    expect(honey.status).toBe(422);
    const fast = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: issueFormToken() }));
    expect(fast.status).toBe(422);
    const forged = await handleEligibility(jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: "123.abc" }));
    expect(forged.status).toBe(422);
    const notJson = await handleEligibility(
      new Request("http://localhost/api/eligibility", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" }),
    );
    expect(notJson.status).toBe(400);
    const { db } = await import("@/lib/db");
    expect(db().prepare("SELECT COUNT(*) n FROM inquiries").get()).toEqual({ n: 0 });
  });

  it("rate limits repeated submissions from one connection", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await handleEligibility(
        jsonRequest("/api/eligibility", { ...VALID_INQUIRY, formToken: oldFormToken() }, { "x-forwarded-for": "203.0.113.9" }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});
