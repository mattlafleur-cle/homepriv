"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Checkbox, ErrorSummary, postJson, TextField, type Errors } from "./form-parts";

const LABELS: Record<string, string> = {
  authorizationName: "Your full name as signature",
  authorizationConfirmed: "Authorization",
  listingAgent: "Listing agent or brokerage",
  ownerNotes: "Anything we should know",
};

export function OnboardingForm({ token, address }: { token: string; address: string }) {
  const router = useRouter();
  const [v, setV] = useState({ authorizationName: "", authorizationConfirmed: false, listingAgent: "", ownerNotes: "", streetViewConsent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    if (failures) summaryRef.current?.focus();
  }, [failures]);

  const set = <K extends keyof typeof v>(k: K) => (val: (typeof v)[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const { status, data } = await postJson("/api/onboarding", { ...v, token });
      if (status === 200 && data.ok) {
        router.refresh();
        return;
      }
      if (data.fieldErrors) setErrors(data.fieldErrors as Errors);
      else setFormError(typeof data.formError === "string" ? data.formError : "We couldn't save this. Your answers are still here. Please try again.");
      setFailures((n) => n + 1);
    } catch {
      setFormError("We couldn't reach our server. Check your connection and try again. Your answers are still here.");
      setFailures((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-8">
      <ErrorSummary errors={errors} labels={LABELS} formError={formError} summaryRef={summaryRef} />

      <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5 sm:p-6">
        <legend className="px-1 font-display text-[1.35rem] font-medium">Written authorization</legend>
        <div className="rounded-lg bg-sand/60 p-4 text-[0.975rem] leading-relaxed">
          I authorize Home Privacy Cleanup to act on my behalf to find and request removal or public suppression of listing
          photos, floor plans, and virtual tours of <strong>{address}</strong>. This includes contacting property websites,
          search engines, one listing agent or brokerage, and the applicable MLS contact. I confirm that I own this home or am
          authorized by its owner. I understand that websites decide how to respond and that complete removal is not guaranteed.
        </div>
        <Checkbox name="authorizationConfirmed" checked={v.authorizationConfirmed} onChange={set("authorizationConfirmed")} error={errors.authorizationConfirmed}>
          I agree to this authorization and the <Link className="text-link" href="/terms" target="_blank">terms of service</Link>.
        </Checkbox>
        <TextField
          name="authorizationName"
          label={LABELS.authorizationName}
          autoComplete="name"
          hint="Typing your name here works as your signature."
          value={v.authorizationName}
          onChange={set("authorizationName")}
          error={errors.authorizationName}
          maxLength={120}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-[1.35rem] font-medium">Helpful details</legend>
        <TextField
          name="listingAgent"
          label={LABELS.listingAgent}
          optional
          hint="If you know who listed the home before you bought it, tell us. If not, we'll find out."
          value={v.listingAgent}
          onChange={set("listingAgent")}
          error={errors.listingAgent}
          maxLength={300}
        />
        <TextField name="ownerNotes" label={LABELS.ownerNotes} optional multiline rows={3} value={v.ownerNotes} onChange={set("ownerNotes")} error={errors.ownerNotes} maxLength={1500} />
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-line p-5 sm:p-6">
        <legend className="px-1 font-display text-[1.35rem] font-medium">Optional: Google Street View blur</legend>
        <p className="text-[0.975rem] text-muted">
          Separate from listing photos, Google lets owners ask for their house to be blurred in Street View. If you&apos;d like, we
          guide you through Google&apos;s request. Google requires the owner to take certain steps, including proof of address.
          Once Google blurs a house, the blur is permanent and cannot be reversed.
        </p>
        <Checkbox name="streetViewConsent" checked={v.streetViewConsent} onChange={set("streetViewConsent")}>
          Yes, guide me through a Street View blur request. I understand the blur is permanent once applied.
        </Checkbox>
      </fieldset>

      <div>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
          {submitting ? "Saving…" : "Finish onboarding and start my cleanup"}
        </button>
        <p className="mt-3 text-[0.9375rem] text-muted">Your service window starts when you submit this form.</p>
      </div>
    </form>
  );
}
