import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, setEnv, VALID_INQUIRY } from "./helpers";

// Simulated request context for server actions.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { ADMIN_COOKIE, checkPassword, makeSessionValue, verifySessionValue } from "@/lib/admin-auth";
import { approveAction, declineAction, loginAction } from "@/app/admin/actions";
import { findInquiry, submitInquiry } from "@/lib/eligibility";
import { eligibilitySchema } from "@/lib/validation";

async function pendingRef() {
  const r = await submitInquiry(eligibilitySchema.parse(VALID_INQUIRY));
  return r.refCode;
}

beforeEach(() => {
  setEnv();
  freshDb();
  cookieJar.clear();
});

describe("admin authentication", () => {
  it("checks the password without accepting near misses", () => {
    expect(checkPassword("correct-horse-battery")).toBe(true);
    expect(checkPassword("correct-horse-batter")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });

  it("accepts only untampered, unexpired session cookies", () => {
    const v = makeSessionValue();
    expect(verifySessionValue(v)).toBe(true);
    expect(verifySessionValue(v.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(verifySessionValue(`${Date.now() + 999999999}.forged`)).toBe(false);
    expect(verifySessionValue(makeSessionValue(Date.now() - 13 * 60 * 60 * 1000))).toBe(false);
    expect(verifySessionValue(undefined)).toBe(false);
  });

  it("disables admin entirely when secrets are missing", () => {
    const v = makeSessionValue();
    setEnv({ ADMIN_PASSWORD: "" });
    expect(verifySessionValue(v)).toBe(false);
    expect(checkPassword("correct-horse-battery")).toBe(false);
  });

  it("logs in with the right password and sets a session", async () => {
    const bad = await loginAction(undefined, formData({ password: "wrong" }));
    expect(bad?.error).toMatch(/isn't right/);
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(false);
    await expect(loginAction(undefined, formData({ password: "correct-horse-battery" }))).rejects.toThrow("REDIRECT:/admin");
    expect(verifySessionValue(cookieJar.get(ADMIN_COOKIE))).toBe(true);
  });
});

describe("protected approval", () => {
  it("refuses to approve or decline without an admin session", async () => {
    const ref = await pendingRef();
    await expect(approveAction(undefined, formData({ id: ref }))).rejects.toThrow("REDIRECT:/admin/login");
    await expect(declineAction(undefined, formData({ id: ref, reason: "other" }))).rejects.toThrow("REDIRECT:/admin/login");
    cookieJar.set(ADMIN_COOKIE, "9999999999999.forged");
    await expect(approveAction(undefined, formData({ id: ref }))).rejects.toThrow("REDIRECT:/admin/login");
    expect((await findInquiry(ref))?.status).toBe("pending_review");
  });

  it("approves with a valid session and returns a one-time customer link", async () => {
    const ref = await pendingRef();
    cookieJar.set(ADMIN_COOKIE, makeSessionValue());
    const r = await approveAction(undefined, formData({ id: ref }));
    expect(r.ok).toContain(ref);
    expect(r.link).toMatch(/^http:\/\/localhost:3000\/c\/[A-Za-z0-9_-]{43}$/);
    const row = (await findInquiry(ref))!;
    expect(row.status).toBe("approved");
    expect(row.decided_by).toBe("Test Operator");
    // Only the hash is stored.
    const token = r.link!.split("/c/")[1];
    const { db } = await import("@/lib/db");
    const dump = JSON.stringify((await db.all("SELECT * FROM inquiries")));
    expect(dump).not.toContain(token);
  });

  it("declines with a customer-safe reason and invalidates any link", async () => {
    const ref = await pendingRef();
    cookieJar.set(ADMIN_COOKIE, makeSessionValue());
    await approveAction(undefined, formData({ id: ref }));
    const r = await declineAction(undefined, formData({ id: ref, reason: "no_exposure", note: "internal only" }));
    expect(r.ok).toContain("Declined");
    const row = (await findInquiry(ref))!;
    expect(row.status).toBe("declined");
    const { db } = await import("@/lib/db");
    const mail = (await db.get("SELECT text FROM email_outbox WHERE template='declined'")) as { text: string };
    expect(mail.text).not.toContain("internal only");
    expect(row.decision_note).toContain("internal only");
  });
});

function formData(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
