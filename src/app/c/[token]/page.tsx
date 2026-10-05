import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { OnboardingForm } from "@/components/OnboardingForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { customerByToken, formatMoney, latestCheckout } from "@/lib/payments";
import { addressLine } from "@/lib/eligibility";
import { formatDate } from "@/lib/onboarding";
import { paymentProvider } from "@/config/site";
import { coveredSitesSentence, offer, termsConfirmed } from "@/config/offer";

export const metadata: Metadata = {
  title: "Your home cleanup",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  payment_failed: "The payment didn't go through, and you haven't been charged. You can try again with another card.",
  checkout_failed: "We couldn't open the payment page just now. You haven't been charged. Please try again in a minute.",
  ordering_closed: "Paid ordering isn't open right now. You haven't been charged. We'll email you when it is.",
  not_approved: "This link can't be used for payment. Please contact us if you think that's a mistake.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="main" className="container-page py-10 md:py-16">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "border-open bg-open-bg/60" : tone === "ok" ? "border-ok bg-ok-bg" : "border-wait bg-wait-bg/70";
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={`mb-6 rounded-xl border-l-4 p-4 ${cls}`}>
      {children}
    </div>
  );
}

export default async function CustomerPage(props: PageProps<"/c/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const found = await customerByToken(token);

  if (!found || found.inquiry.status === "declined") {
    return (
      <Shell>
        <h1 className="text-[2rem] font-medium">This link isn&apos;t working</h1>
        <p className="mt-4 text-muted">
          It may have been replaced by a newer link, or it may have been copied incompletely. Please use the most recent email
          from us, or reply to it and we&apos;ll help.
        </p>
        <p className="mt-6"><Link className="text-link" href="/">Go to the homepage</Link></p>
      </Shell>
    );
  }

  const { inquiry, order } = found;
  const address = addressLine(inquiry);
  const isTest = Boolean(inquiry.is_test);

  if (order) {
    const receipt = (
      <div className="mt-6 rounded-xl border border-line bg-paper p-5">
        <h2 className="font-sans text-[1rem] font-semibold">Receipt</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.975rem]">
          <dt className="text-muted">Order</dt><dd className="font-mono">{order.order_number}</dd>
          <dt className="text-muted">Home</dt><dd>{address}</dd>
          <dt className="text-muted">Paid</dt><dd>{formatMoney(order.amount_cents)} on {formatDate(order.paid_at)}{isTest ? " (test payment)" : ""}</dd>
          <dt className="text-muted">Status</dt>
          <dd>{order.status === "awaiting_intake" ? "Waiting for onboarding" : order.status === "refunded" ? "Refunded" : order.status === "completed" ? "Complete" : "In service"}</dd>
        </dl>
        {order.provider === "stripe" && <p className="mt-3 text-[0.875rem] text-muted">Stripe also emails a payment receipt.</p>}
      </div>
    );

    if (order.status === "awaiting_intake") {
      return (
        <Shell>
          {sp.returned && <Notice tone="ok"><strong>Payment confirmed.</strong> Thank you.</Notice>}
          <p className="eyebrow">Step 2 of 3</p>
          <h1 className="mt-3 text-[2.1rem] font-medium">One last step before we start</h1>
          <p className="mt-4 text-muted">
            We need your written authorization to act for you. Your {offer.serviceDays}-day service window starts when this form is
            complete. If you need to stop, you can come back to this page from the link in your email.
          </p>
          {receipt}
          <div className="mt-10">
            <OnboardingForm token={token} address={address} />
          </div>
        </Shell>
      );
    }

    return (
      <Shell>
        <p className="eyebrow">Your home cleanup</p>
        <h1 className="mt-3 text-[2.1rem] font-medium">
          {order.status === "refunded" ? "This order was refunded" : "We're on it"}
        </h1>
        {order.status !== "refunded" && order.service_ends_at && (
          <ul className="mt-6 space-y-3">
            <li className="rounded-xl bg-paper p-4"><strong>Service window:</strong> {formatDate(order.intake_completed_at)} to {formatDate(order.service_ends_at)}</li>
            <li className="rounded-xl bg-paper p-4"><strong>Updates:</strong> by email every week during the window</li>
            <li className="rounded-xl bg-paper p-4"><strong>Final report:</strong> at the end of the window</li>
            <li className="rounded-xl bg-paper p-4"><strong>Recheck:</strong> around {formatDate(order.recheck_at)}</li>
            <li className="rounded-xl bg-paper p-4">
              <strong>Street View blur request:</strong> {order.street_view_consent ? "requested, and we'll guide you through Google's owner steps" : "not requested"}
            </li>
          </ul>
        )}
        {receipt}
        <p className="mt-6 text-muted">If a site needs something only the owner can do, we&apos;ll email you exactly what to do and why.</p>
      </Shell>
    );
  }

  // Approved, not yet paid.
  const provider = paymentProvider();
  const checkout = await latestCheckout(inquiry.id);
  const waiting =
    checkout?.status === "processing" || (Boolean(sp.returned) && (checkout?.status === "open" || checkout?.status === "completed"));

  if (provider === "none") {
    return (
      <Shell>
        <h1 className="text-[2rem] font-medium">Your home qualifies</h1>
        <p className="mt-4 text-muted">
          We reviewed {address} and it looks like a fit. Paid ordering isn&apos;t open yet. When it opens, we&apos;ll email you, and
          this page will let you pay. You haven&apos;t been charged anything.
        </p>
      </Shell>
    );
  }

  if (waiting) {
    return (
      <Shell>
        <h1 className="text-[2rem] font-medium">Confirming your payment</h1>
        <p className="mt-4 text-muted" role="status">
          We&apos;re waiting for confirmation from the payment processor. This page updates on its own. Please don&apos;t pay again.
        </p>
        <AutoRefresh />
      </Shell>
    );
  }

  const errorKey = typeof sp.error === "string" ? sp.error : checkout?.status === "failed" ? "payment_failed" : undefined;
  return (
    <Shell>
      {sp.canceled && <Notice tone="info">Payment wasn&apos;t completed, and you haven&apos;t been charged. You can pay whenever you&apos;re ready.</Notice>}
      {errorKey && <Notice tone="warn">{ERRORS[errorKey] ?? ERRORS.checkout_failed}</Notice>}
      {isTest && <Notice tone="info">Preview test request. Payment here is a test and no money moves.</Notice>}
      <p className="eyebrow">Your home qualifies</p>
      <h1 className="mt-3 text-[2.1rem] font-medium">Review and pay</h1>
      <div className="mt-6 rounded-[var(--radius-card)] border-2 border-evergreen bg-paper p-6 sm:p-8">
        <p className="text-muted">Home</p>
        <p className="text-[1.15rem] font-semibold">{address}</p>
        <p className="mt-1 text-[0.9375rem] text-muted">Reference {inquiry.ref_code}</p>
        <ul className="mt-6 space-y-2 text-[0.975rem]">
          <li>Audit of {coveredSitesSentence}, plus up to {offer.additionalSitesLimit} more public websites we find</li>
          <li>Removal or suppression requests, and contact with the original listing source</li>
          <li>{offer.serviceDays} days of follow-up with weekly updates, a final report, and a day-{offer.recheckDay} recheck</li>
        </ul>
        <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
          <span className="font-semibold">Total, paid once</span>
          <span className="font-display text-[2rem] font-medium">{formatMoney(offer.priceCents)}</span>
        </div>
        <form method="post" action={`/c/${token}/checkout`} className="mt-6">
          <button type="submit" className="btn-primary w-full">
            {provider === "simulated" ? "Continue to test payment" : "Continue to secure payment"}
          </button>
        </form>
        <p className="mt-4 text-[0.9375rem] text-muted">
          {provider === "stripe"
            ? "You'll pay on Stripe's secure checkout page. We never see your card number."
            : "Preview mode: the next page simulates payment. No card details are collected."}{" "}
          By paying, you agree to the <Link className="text-link" href="/terms">terms</Link> and{" "}
          <Link className="text-link" href="/refunds">refund policy</Link>
          {termsConfirmed() ? "." : " (draft terms, preview only)."}
        </p>
      </div>
      <p className="mt-6 text-[0.9375rem] text-muted">Questions first? Reply to the email that brought you here.</p>
    </Shell>
  );
}
