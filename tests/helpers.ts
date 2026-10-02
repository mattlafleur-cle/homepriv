import { vi } from "vitest";
import { resetDbForTests, db } from "@/lib/db";
import { issueFormToken } from "@/lib/guard";

const BASE_ENV = {
  LAUNCH_MODE: "preview",
  SITE_URL: "http://localhost:3000",
  DATABASE_PATH: ":memory:",
  DATABASE_DURABLE: "",
  OPERATOR_NAME: "Test Operator",
  ADMIN_PASSWORD: "correct-horse-battery",
  SESSION_SECRET: "test-session-secret-0123456789abcdef0123",
  CONTACT_EMAIL: "",
  BUSINESS_LEGAL_NAME: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  SITE_INDEXABLE: "",
};

export function setEnv(overrides: Partial<Record<keyof typeof BASE_ENV, string>> = {}) {
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (v === "") delete process.env[k];
    else process.env[k] = v;
  }
}

export function freshDb() {
  resetDbForTests();
  return db();
}

/** A form token old enough to pass the "too fast" check. */
export function oldFormToken() {
  return issueFormToken(Date.now() - 10_000);
}

export const VALID_INQUIRY = {
  street: "100 Sample Test Lane",
  city: "Testville",
  state: "OH",
  zip: "44000",
  name: "Pat Example",
  email: "pat@example.com",
  phone: "",
  relationship: "owner",
  listingStatus: "not_listed",
  listingLinks: "https://listing-site.example/a",
  notes: "",
  authorizationConfirmed: true,
  serviceConsent: true,
  marketingConsent: false,
};

let ipCounter = 0;
export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipCounter % 250}`, ...headers },
    body: JSON.stringify(body),
  });
}

export function silenceConsole() {
  vi.spyOn(console, "error").mockImplementation(() => {});
}

export const PII = ["Pat Example", "pat@example.com", "100 Sample Test Lane", "Testville", "44000"];
