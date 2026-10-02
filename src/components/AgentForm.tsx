"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Checkbox, ErrorSummary, Honeypot, postJson, TextField, type Errors } from "./form-parts";

const EMPTY = { name: "", email: "", brokerage: "", message: "", contactConsent: false, marketingConsent: false };
const LABELS: Record<string, string> = {
  name: "Your name",
  email: "Email",
  brokerage: "Brokerage",
  message: "How you'd use it",
  contactConsent: "Permission to reply",
};

export function AgentForm({ formToken }: { formToken: string }) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [honey, setHoney] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    if (failures) summaryRef.current?.focus();
  }, [failures]);
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const set = <K extends keyof typeof EMPTY>(k: K) => (val: (typeof EMPTY)[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const { status, data } = await postJson("/api/agent-inquiry", { ...v, website: honey, formToken });
      if (status === 200 && data.ok) {
        setDone(true);
        return;
      }
      if (data.fieldErrors) setErrors(data.fieldErrors as Errors);
      else setFormError(typeof data.formError === "string" ? data.formError : "We couldn't send that. Please try again.");
      setFailures((n) => n + 1);
    } catch {
      setFormError("We couldn't reach our server. Check your connection and try again.");
      setFailures((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-card)] bg-paper p-6 sm:p-8" aria-live="polite">
        <p ref={doneRef} tabIndex={-1} className="font-display text-[1.4rem] font-medium">Thanks. We&apos;ll be in touch by email.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative space-y-5 rounded-[var(--radius-card)] bg-paper p-6 sm:p-8">
      <ErrorSummary errors={errors} labels={LABELS} formError={formError} summaryRef={summaryRef} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label={LABELS.name} autoComplete="name" value={v.name} onChange={set("name")} error={errors.name} maxLength={120} />
        <TextField name="email" label={LABELS.email} type="email" inputMode="email" autoComplete="email" value={v.email} onChange={set("email")} error={errors.email} maxLength={254} />
      </div>
      <TextField name="brokerage" label={LABELS.brokerage} optional autoComplete="organization" value={v.brokerage} onChange={set("brokerage")} error={errors.brokerage} maxLength={150} />
      <TextField name="message" label={LABELS.message} optional multiline rows={3} value={v.message} onChange={set("message")} error={errors.message} maxLength={1500} />
      <Checkbox name="contactConsent" checked={v.contactConsent} onChange={set("contactConsent")} error={errors.contactConsent}>
        You may use these details to reply to me about closing gifts. <Link className="text-link" href="/privacy">Privacy notice</Link>
      </Checkbox>
      <Checkbox name="marketingConsent" checked={v.marketingConsent} onChange={set("marketingConsent")}>
        <span className="text-muted">Optional: send me occasional news. I can unsubscribe anytime.</span>
      </Checkbox>
      <Honeypot value={honey} onChange={setHoney} />
      <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Sending…" : "Ask about closing gifts"}
      </button>
    </form>
  );
}
