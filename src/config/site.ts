import "server-only";
import { offer, termsConfirmed } from "./offer";

/**
 * Runtime configuration read from environment variables. See .env.example.
 * Nothing here should be invented: missing values stay missing and block
 * sales mode instead of being filled with placeholders.
 */

export type LaunchMode = "preview" | "interest" | "sales";

function str(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function requestedMode(): LaunchMode {
  const v = str("LAUNCH_MODE");
  return v === "interest" || v === "sales" ? v : "preview";
}

export const isProduction = () => process.env.NODE_ENV === "production";

export function siteUrl(): string {
  return (str("SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function contact() {
  return {
    email: str("CONTACT_EMAIL"),
    phone: str("CONTACT_PHONE"),
    legalName: str("BUSINESS_LEGAL_NAME"),
    mailingAddress: str("BUSINESS_MAILING_ADDRESS"),
    operatorName: str("OPERATOR_NAME"),
  };
}

export function vendors() {
  return {
    hosting: str("HOSTING_PROVIDER_NAME"),
    database: /turso\.io/.test(str("DATABASE_URL") ?? "") ? "Turso" : undefined,
    email: str("RESEND_API_KEY") ? "Resend" : undefined,
    payments: "Stripe",
  };
}

export type PaymentProvider = "stripe" | "simulated" | "none";

export function stripeKeys() {
  return {
    secretKey: str("STRIPE_SECRET_KEY"),
    webhookSecret: str("STRIPE_WEBHOOK_SECRET"),
  };
}

export function emailConfig() {
  return {
    resendApiKey: str("RESEND_API_KEY"),
    from: str("EMAIL_FROM"),
    replyTo: str("EMAIL_REPLY_TO") ?? str("CONTACT_EMAIL"),
  };
}

export function adminConfig() {
  return {
    password: str("ADMIN_PASSWORD"),
    sessionSecret: str("SESSION_SECRET"),
  };
}

export type ReadinessItem = { key: string; label: string; ok: boolean };

/** Everything sales mode needs. Labels are for the operator, not customers. */
export function salesReadiness(): ReadinessItem[] {
  const { secretKey, webhookSecret } = stripeKeys();
  const email = emailConfig();
  const admin = adminConfig();
  const c = contact();
  const url = siteUrl();
  const liveKeyRequired = isProduction();

  return [
    {
      key: "payments",
      label: liveKeyRequired
        ? "Stripe live secret key and webhook signing secret"
        : "Stripe secret key and webhook signing secret",
      ok: Boolean(
        secretKey &&
          webhookSecret &&
          (liveKeyRequired ? secretKey.startsWith("sk_live_") : /^sk_(test|live)_/.test(secretKey)),
      ),
    },
    {
      key: "storage",
      label: "Durable database (a hosted Turso DATABASE_URL, or a local DATABASE_PATH on a persistent disk with DATABASE_DURABLE=true)",
      ok: /^(libsql|https|wss?):\/\//.test(str("DATABASE_URL") ?? "")
        ? Boolean(str("DATABASE_AUTH_TOKEN"))
        : Boolean(str("DATABASE_PATH")) && str("DATABASE_DURABLE") === "true",
    },
    {
      key: "email",
      label: "Transactional email (RESEND_API_KEY and EMAIL_FROM)",
      ok: Boolean(email.resendApiKey && email.from),
    },
    {
      key: "operator",
      label: "Identified operator with admin access (OPERATOR_NAME, ADMIN_PASSWORD of 12+ characters, SESSION_SECRET of 32+ characters)",
      ok: Boolean(
        c.operatorName &&
          admin.password &&
          admin.password.length >= 12 &&
          admin.sessionSecret &&
          admin.sessionSecret.length >= 32,
      ),
    },
    {
      key: "terms",
      label: "Price, scope, refund, and legal pages confirmed in src/config/offer.ts",
      ok: termsConfirmed(),
    },
    {
      key: "contact",
      label: "Public contact identity (CONTACT_EMAIL and BUSINESS_LEGAL_NAME)",
      ok: Boolean(c.email && c.legalName),
    },
    {
      key: "site",
      label: "Public site address (SITE_URL using https)",
      ok: url.startsWith("https://"),
    },
  ];
}

export function salesReady() {
  return salesReadiness().every((i) => i.ok);
}

/**
 * The mode the site actually runs in. Sales mode without full configuration
 * falls back to interest mode, which openly says ordering is not yet open.
 * It never pretends a purchase happened.
 */
export function effectiveMode(): LaunchMode {
  const m = requestedMode();
  if (m === "sales" && !salesReady()) return "interest";
  return m;
}

export function paymentProvider(): PaymentProvider {
  const mode = effectiveMode();
  const { secretKey, webhookSecret } = stripeKeys();
  if (mode === "interest") return "none";
  if (mode === "sales") return "stripe";
  // Preview: Stripe only with a test key, otherwise an on-site simulated test payment.
  if (secretKey?.startsWith("sk_test_") && webhookSecret) return "stripe";
  return "simulated";
}

/** Search engines may index only a real, configured public deployment. */
export function indexable() {
  return (
    isProduction() &&
    str("SITE_INDEXABLE") === "true" &&
    effectiveMode() !== "preview" &&
    siteUrl().startsWith("https://")
  );
}

export function modeCopy(mode: LaunchMode = effectiveMode()) {
  if (mode === "interest") {
    return {
      primaryCta: "Check if my home qualifies",
      ctaSupport: `${offer.priceLabel} once, when ordering opens. Paid ordering isn't open yet, so nothing is charged now.`,
    };
  }
  return {
    primaryCta: "Start my home cleanup",
    ctaSupport: `${offer.priceLabel} once. One home. Eligibility checked before payment.`,
  };
}
