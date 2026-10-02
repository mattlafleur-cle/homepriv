"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Checkbox, ErrorSummary, Honeypot, postJson, RadioGroup, TextField, type Errors } from "./form-parts";
import { sendEvent } from "./CtaLink";
import { US_STATES } from "@/lib/states";

type Mode = "preview" | "interest" | "sales";

const EMPTY = {
  street: "",
  unit: "",
  city: "",
  state: "OH",
  zip: "",
  name: "",
  email: "",
  phone: "",
  relationship: "",
  listingStatus: "",
  listingLinks: "",
  notes: "",
  authorizationConfirmed: false,
  serviceConsent: false,
  marketingConsent: false,
};

const SAMPLE = {
  ...EMPTY,
  street: "100 Sample Test Lane",
  city: "Testville",
  state: "OH",
  zip: "44000",
  name: "Test Homeowner",
  email: "test-homeowner@example.com",
  relationship: "owner",
  listingStatus: "not_listed",
  listingLinks: "https://listing-site.example/sample-home",
  notes: "Preview test request. Not a real home.",
  authorizationConfirmed: true,
  serviceConsent: true,
};

const LABELS: Record<string, string> = {
  street: "Street address",
  unit: "Apartment or unit",
  city: "City",
  state: "State",
  zip: "ZIP code",
  name: "Your full name",
  email: "Email",
  phone: "Phone",
  relationship: "Your connection to the home",
  listingStatus: "Listing status",
  listingLinks: "Listing links",
  notes: "Anything else",
  authorizationConfirmed: "Authorization",
  serviceConsent: "Permission to review",
  form: "Form",
};

type Result = { refCode: string; outcome: "review" | "listed" };

export function EligibilityForm({ formToken, mode, privacyHref = "/privacy" }: { formToken: string; mode: Mode; privacyHref?: string }) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>();
  const [honey, setHoney] = useState("");
  const started = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    if (failures) summaryRef.current?.focus();
  }, [failures]);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof typeof EMPTY>(k: K) => (val: (typeof EMPTY)[K]) => {
    setV((prev) => ({ ...prev, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function markStarted() {
    if (!started.current) {
      started.current = true;
      sendEvent("eligibility_started");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const { status, data } = await postJson("/api/eligibility", { ...v, website: honey, formToken });
      if (status === 200 && data.ok) {
        setResult({ refCode: String(data.refCode), outcome: data.outcome === "listed" ? "listed" : "review" });
        return;
      }
      if (data.fieldErrors) {
        setErrors(data.fieldErrors as Errors);
      } else {
        setErrors({});
        setFormError(
          typeof data.formError === "string"
            ? data.formError
            : "We couldn't send your request. Your details are still here. Please try again.",
        );
      }
      setFailures((n) => n + 1);
    } catch {
      setFormError("We couldn't reach our server. Check your connection and try again. Your details are still here.");
      setFailures((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-9" aria-live="polite">
        {result.outcome === "listed" ? (
          <>
            <h2 ref={resultRef} tabIndex={-1} className="text-[1.75rem] font-medium">This home is listed right now, so it isn&apos;t eligible yet.</h2>
            <p className="mt-4 text-muted">
              Active listings are supposed to show photos, so we only work on homes that are off the market. Once the listing ends,
              you&apos;re welcome to send a new request. Nothing has been charged.
            </p>
          </>
        ) : (
          <>
            <h2 ref={resultRef} tabIndex={-1} className="text-[1.75rem] font-medium">
              {mode === "interest" ? "Thanks. We'll review your home." : "We'll review your home before payment."}
            </h2>
            <p className="mt-4 text-muted">
              A person will look at whether the home is off the market and whether there are listing photos, floor plans, or virtual
              tours we can work on. Nothing has been charged.
            </p>
            <h3 className="mt-6 font-sans text-[1rem] font-semibold">What happens next</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>We send a confirmation to the email you gave us.</li>
              {mode === "interest" ? (
                <li>We email you what we find. Paid ordering isn&apos;t open yet, and we&apos;ll let you know when it is.</li>
              ) : (
                <>
                  <li>If your home qualifies, we email you a secure link to pay $499. If it doesn&apos;t, we tell you why.</li>
                  <li>After payment, a short onboarding form collects your written authorization, and the work begins.</li>
                </>
              )}
            </ol>
          </>
        )}
        <div className="mt-6 rounded-xl bg-sand/70 p-4">
          <p className="text-[0.9375rem] text-muted">Your reference number</p>
          <p className="mt-1 font-mono text-[1.25rem] font-semibold tracking-wider">{result.refCode}</p>
        </div>
        {mode === "preview" && (
          <p className="mt-4 rounded-lg border border-dashed border-[#9a8f78] bg-[#fff8e6] p-3 text-[0.9375rem]">
            Preview: approve this test request in <Link className="text-link" href="/admin">/admin</Link> or with{" "}
            <code className="font-mono">npm run ops -- approve {result.refCode}</code>, then open the checkout link it gives you.
          </p>
        )}
        <p className="mt-6">
          <Link href="/" className="text-link">Back to the homepage</Link>
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} onFocusCapture={markStarted} className="relative space-y-8">
      <ErrorSummary errors={errors} labels={LABELS} formError={formError} summaryRef={summaryRef} />

      {mode === "preview" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#9a8f78] bg-[#fff8e6] p-4 text-[0.9375rem]">
          <span>Preview mode: use obvious test details only.</span>
          <button type="button" className="btn-secondary !min-h-10 !px-3 !py-1.5 !text-[0.9375rem]" onClick={() => setV(SAMPLE)}>
            Fill with test details
          </button>
        </div>
      )}

      <fieldset className="space-y-5">
        <legend className="font-display text-[1.5rem] font-medium">The home</legend>
        <TextField name="street" label={LABELS.street} autoComplete="address-line1" value={v.street} onChange={set("street")} error={errors.street} maxLength={200} />
        <TextField name="unit" label={LABELS.unit} optional autoComplete="address-line2" value={v.unit} onChange={set("unit")} error={errors.unit} maxLength={40} />
        <div className="grid gap-5 sm:grid-cols-[1.4fr_0.8fr_1fr]">
          <TextField name="city" label={LABELS.city} autoComplete="address-level2" value={v.city} onChange={set("city")} error={errors.city} maxLength={100} />
          <div>
            <label htmlFor="f-state" className="field-label">{LABELS.state}</label>
            <select
              id="f-state"
              name="state"
              className="field-input"
              autoComplete="address-level1"
              value={v.state}
              onChange={(e) => set("state")(e.target.value)}
              aria-invalid={errors.state ? true : undefined}
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.state && <p className="field-error">{errors.state}</p>}
          </div>
          <TextField name="zip" label={LABELS.zip} autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} error={errors.zip} maxLength={10} />
        </div>
        <RadioGroup
          name="listingStatus"
          legend="Is the home listed for sale or rent right now?"
          value={v.listingStatus}
          onChange={set("listingStatus")}
          error={errors.listingStatus}
          options={[
            { value: "not_listed", label: "No, it's off the market" },
            { value: "listed", label: "Yes, it's listed right now" },
            { value: "unsure", label: "I'm not sure" },
          ]}
        />
        <TextField
          name="listingLinks"
          label={LABELS.listingLinks}
          optional
          multiline
          rows={3}
          hint="If you've seen the photos online, paste up to five links, one per line. It helps, but we'll look either way."
          inputMode="url"
          value={v.listingLinks}
          onChange={set("listingLinks")}
          error={errors.listingLinks}
          maxLength={2000}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-[1.5rem] font-medium">About you</legend>
        <TextField name="name" label={LABELS.name} autoComplete="name" value={v.name} onChange={set("name")} error={errors.name} maxLength={120} />
        <TextField
          name="email"
          label={LABELS.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="We'll send your review result and any payment link here."
          value={v.email}
          onChange={set("email")}
          error={errors.email}
          maxLength={254}
        />
        <TextField
          name="phone"
          label={LABELS.phone}
          optional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Only if you'd like a call about your request."
          value={v.phone}
          onChange={set("phone")}
          error={errors.phone}
          maxLength={30}
        />
        <RadioGroup
          name="relationship"
          legend={LABELS.relationship}
          value={v.relationship}
          onChange={set("relationship")}
          error={errors.relationship}
          options={[
            { value: "owner", label: "I own the home" },
            { value: "authorized", label: "I'm authorized to act for the owner", hint: "For example, a spouse, trustee, or family member with the owner's permission." },
          ]}
        />
        <TextField name="notes" label={LABELS.notes} optional multiline rows={3} value={v.notes} onChange={set("notes")} error={errors.notes} maxLength={1000} />
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5">
        <legend className="px-1 font-semibold">Before you send</legend>
        <p className="text-[0.9375rem] text-muted">
          We use these details only to review whether we can help with this home, to contact you about this request, and, if you
          go ahead, to deliver the service. We don&apos;t sell them. See our{" "}
          <Link className="text-link" href={privacyHref}>privacy notice</Link>.
        </p>
        <Checkbox name="authorizationConfirmed" checked={v.authorizationConfirmed} onChange={set("authorizationConfirmed")} error={errors.authorizationConfirmed}>
          I own this home or am authorized by the owner to make this request.
        </Checkbox>
        <Checkbox name="serviceConsent" checked={v.serviceConsent} onChange={set("serviceConsent")} error={errors.serviceConsent}>
          You may use these details to review my home and contact me about this request.
        </Checkbox>
        <Checkbox name="marketingConsent" checked={v.marketingConsent} onChange={set("marketingConsent")}>
          <span className="text-muted">Optional: send me occasional news about Home Privacy Cleanup. I can unsubscribe anytime.</span>
        </Checkbox>
      </fieldset>

      <Honeypot value={honey} onChange={setHoney} />

      <div>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting} aria-disabled={submitting}>
          {submitting ? "Sending…" : "Send for review"}
        </button>
        <p className="mt-3 text-[0.9375rem] text-muted">
          {mode === "interest"
            ? "Nothing is charged. Paid ordering isn't open yet."
            : "Nothing is charged now. If your home qualifies, you'll get a secure payment link by email."}
        </p>
      </div>
    </form>
  );
}
