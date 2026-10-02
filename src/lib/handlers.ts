import "server-only";
import { agentInquirySchema, eligibilitySchema, fieldErrors, onboardingSchema } from "./validation";
import { checkFormToken, clientIp, rateLimit } from "./guard";
import { submitInquiry } from "./eligibility";
import { CLIENT_EVENTS, CTA_LOCATIONS, track } from "./events";
import { handleStripeWebhook } from "./payments";
import { completeOnboarding } from "./onboarding";
import { db, nowIso } from "./db";
import { newId } from "./tokens";
import { notifyOperator } from "./email";
import { effectiveMode } from "@/config/site";

/**
 * Request handlers for the public API routes. Responses never echo names,
 * emails, addresses, or phone numbers back to the browser.
 */

const MAX_BODY = 20_000;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.includes("application/json")) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const GENERIC_ERROR = "Something went wrong on our side and your request wasn't saved. Please try again in a minute.";

function spamCheck(body: Record<string, unknown>) {
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return "We couldn't accept this submission. If you're a person, please clear the form and try again.";
  }
  const t = checkFormToken(body.formToken);
  if (t === "too_fast") return "That was quick. Please check your details and submit again.";
  if (t === "expired") return "This form has been open a long time. Please reload the page and submit again.";
  if (t === "invalid") return "Please reload the page and submit again.";
  return null;
}

export async function handleEligibility(req: Request) {
  if (!rateLimit("eligibility", clientIp(req.headers), 5, 600)) {
    return json({ ok: false, formError: "Too many requests from this connection. Please wait a few minutes and try again." }, 429);
  }
  const body = await readJson(req);
  if (!body) return json({ ok: false, formError: "Please reload the page and submit again." }, 400);
  const spam = spamCheck(body);
  if (spam) return json({ ok: false, formError: spam }, 422);

  const parsed = eligibilitySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, fieldErrors: fieldErrors(parsed.error) }, 422);

  try {
    const { refCode, status } = await submitInquiry(parsed.data);
    return json({ ok: true, refCode, outcome: status === "listed_not_eligible" ? "listed" : "review", mode: effectiveMode() });
  } catch (err) {
    console.error(`[eligibility] save failed: ${err instanceof Error ? err.name : "unknown"}`);
    return json({ ok: false, formError: GENERIC_ERROR }, 500);
  }
}

export async function handleAgentInquiry(req: Request) {
  if (!rateLimit("agent", clientIp(req.headers), 5, 600)) {
    return json({ ok: false, formError: "Too many requests from this connection. Please wait a few minutes and try again." }, 429);
  }
  const body = await readJson(req);
  if (!body) return json({ ok: false, formError: "Please reload the page and submit again." }, 400);
  const spam = spamCheck(body);
  if (spam) return json({ ok: false, formError: spam }, 422);
  const parsed = agentInquirySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, fieldErrors: fieldErrors(parsed.error) }, 422);

  try {
    const id = newId();
    const d = parsed.data;
    db()
      .prepare(
        "INSERT INTO agent_inquiries(id, is_test, name, email, brokerage, message, marketing_consent, created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(id, effectiveMode() === "preview" ? 1 : 0, d.name, d.email.toLowerCase(), d.brokerage ?? null, d.message ?? null, d.marketingConsent ? 1 : 0, nowIso());
    track("agent_inquiry", { subject: id });
    await notifyOperator("New real estate agent inquiry", ["A real estate agent asked about closing gifts."], id);
    return json({ ok: true });
  } catch (err) {
    console.error(`[agent] save failed: ${err instanceof Error ? err.name : "unknown"}`);
    return json({ ok: false, formError: GENERIC_ERROR }, 500);
  }
}

/** Accepts only known event names and locations. Anything else is dropped. */
export async function handleEvent(req: Request) {
  if (!rateLimit("event", clientIp(req.headers), 120, 60)) return new Response(null, { status: 204 });
  const text = await req.text();
  if (text.length > 500) return new Response(null, { status: 204 });
  try {
    const body = JSON.parse(text) as { name?: unknown; location?: unknown };
    const name = (CLIENT_EVENTS as readonly unknown[]).includes(body.name) ? (body.name as (typeof CLIENT_EVENTS)[number]) : null;
    const location = (CTA_LOCATIONS as readonly unknown[]).includes(body.location) ? (body.location as string) : undefined;
    if (name) track(name, { location });
  } catch {
    /* ignore malformed beacons */
  }
  return new Response(null, { status: 204 });
}

export async function handleStripeWebhookRequest(req: Request) {
  const raw = await req.text();
  try {
    const result = await handleStripeWebhook(raw, req.headers.get("stripe-signature"));
    return json({ received: true, duplicate: result.duplicate });
  } catch (err) {
    const name = err instanceof Error ? err.message : "unknown";
    const isSignature = /signature|webhook secret/i.test(name) || (err as { type?: string })?.type === "StripeSignatureVerificationError";
    console.error(`[webhook] ${isSignature ? "rejected" : "failed"}: ${isSignature ? "invalid signature" : name}`);
    return json({ received: false }, isSignature ? 400 : 500);
  }
}

export async function handleOnboarding(req: Request) {
  const body = await readJson(req);
  if (!body || typeof body.token !== "string") return json({ ok: false, formError: "Please reload the page and try again." }, 400);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, fieldErrors: fieldErrors(parsed.error) }, 422);
  try {
    const result = await completeOnboarding(body.token, parsed.data);
    if ("error" in result) {
      return json(
        {
          ok: false,
          formError:
            result.error === "already_complete"
              ? "Onboarding for this order is already complete. Reload the page to see your service dates."
              : "We couldn't find this order. Please use the link from your payment email.",
        },
        result.error === "already_complete" ? 409 : 404,
      );
    }
    return json({ ok: true });
  } catch (err) {
    console.error(`[onboarding] failed: ${err instanceof Error ? err.name : "unknown"}`);
    return json({ ok: false, formError: GENERIC_ERROR }, 500);
  }
}
