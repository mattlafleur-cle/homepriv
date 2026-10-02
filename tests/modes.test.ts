import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, setEnv, VALID_INQUIRY } from "./helpers";
import { effectiveMode, indexable, modeCopy, paymentProvider, salesReadiness } from "@/config/site";
import { offer } from "@/config/offer";
import { approveInquiry, submitInquiry } from "@/lib/eligibility";
import { eligibilitySchema } from "@/lib/validation";
import { completeSimulatedPayment, startCheckout } from "@/lib/payments";

const FULL_SALES = {
  LAUNCH_MODE: "sales",
  SITE_URL: "https://homeprivacy.example",
  DATABASE_PATH: ":memory:",
  DATABASE_DURABLE: "true",
  OPERATOR_NAME: "Operator",
  ADMIN_PASSWORD: "a-long-admin-password",
  SESSION_SECRET: "x".repeat(40),
  CONTACT_EMAIL: "hello@homeprivacy.example",
  BUSINESS_LEGAL_NAME: "Example LLC",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  RESEND_API_KEY: "re_abc",
  EMAIL_FROM: "Home Privacy Cleanup <hello@homeprivacy.example>",
};

const terms = offer.termsConfirmation as { offerTermsConfirmedOn: string | null; legalPagesConfirmedOn: string | null };

beforeEach(() => {
  setEnv();
  freshDb();
});
afterEach(() => {
  terms.offerTermsConfirmedOn = null;
  terms.legalPagesConfirmedOn = null;
  vi.unstubAllEnvs();
});

describe("launch modes", () => {
  it("defaults to preview with simulated test payments and no indexing", () => {
    setEnv({ LAUNCH_MODE: "" });
    expect(effectiveMode()).toBe("preview");
    expect(paymentProvider()).toBe("simulated");
    expect(indexable()).toBe(false);
  });

  it("never uses a live Stripe key in preview", () => {
    setEnv({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc" });
    expect(paymentProvider()).toBe("simulated");
  });

  it("interest mode collects inquiries but cannot take payment", async () => {
    setEnv({ LAUNCH_MODE: "interest" });
    expect(paymentProvider()).toBe("none");
    expect(modeCopy().primaryCta).toBe("Check if my home qualifies");
    const { refCode } = await submitInquiry(eligibilitySchema.parse(VALID_INQUIRY));
    const { token } = await approveInquiry(refCode, "op");
    await expect(startCheckout(token)).rejects.toThrow("ordering_closed");
    await expect(completeSimulatedPayment(token, "pay")).rejects.toThrow("simulation_disabled");
  });

  it("locks sales mode to interest until every requirement is met", () => {
    setEnv({ ...FULL_SALES });
    // Terms not yet confirmed in offer config.
    expect(salesReadiness().find((r) => r.key === "terms")?.ok).toBe(false);
    expect(effectiveMode()).toBe("interest");
    expect(paymentProvider()).toBe("none");

    terms.offerTermsConfirmedOn = "2026-10-15";
    terms.legalPagesConfirmedOn = "2026-10-15";
    expect(effectiveMode()).toBe("sales");
    expect(paymentProvider()).toBe("stripe");

    for (const missing of ["CONTACT_EMAIL", "RESEND_API_KEY", "STRIPE_WEBHOOK_SECRET", "OPERATOR_NAME"] as const) {
      setEnv({ ...FULL_SALES, [missing]: "" });
      expect(effectiveMode(), `without ${missing}`).toBe("interest");
    }
    setEnv({ ...FULL_SALES, DATABASE_DURABLE: "" });
    expect(effectiveMode()).toBe("interest");
    setEnv({ ...FULL_SALES, SITE_URL: "http://homeprivacy.example" });
    expect(effectiveMode()).toBe("interest");
  });

  it("requires a live Stripe key for sales in production, and only then allows indexing when opted in", () => {
    terms.offerTermsConfirmedOn = "2026-10-15";
    terms.legalPagesConfirmedOn = "2026-10-15";
    vi.stubEnv("NODE_ENV", "production");
    setEnv({ ...FULL_SALES, SITE_INDEXABLE: "true" });
    expect(effectiveMode()).toBe("interest");
    setEnv({ ...FULL_SALES, SITE_INDEXABLE: "true", STRIPE_SECRET_KEY: "sk_live_abc" });
    expect(effectiveMode()).toBe("sales");
    expect(indexable()).toBe(true);
    setEnv({ ...FULL_SALES, STRIPE_SECRET_KEY: "sk_live_abc" });
    expect(indexable()).toBe(false);
  });
});
