import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { offer } from "@/config/offer";
import { contact } from "@/config/site";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  const c = contact();
  const who = c.legalName ?? offer.brandName;
  return (
    <LegalPage title="Terms of service" intro={`These terms cover the ${offer.brandName} service sold on this site by ${who}.`}>
      <h2>The service</h2>
      <p>
        For a one-time fee of {offer.priceLabel}, we manage requests to remove or stop publicly showing listing photos, floor plans,
        and virtual tours of one eligible home, as described on <Link className="text-link" href="/scope">What&apos;s covered</Link>.
        That page is part of these terms.
      </p>

      <h2>Eligibility and approval</h2>
      <p>
        We review each home before payment and may decline any request. You confirm that you own the home or are authorized by its
        owner, and that the information you give us is accurate. Your statement isn&apos;t verified ownership; some websites may
        require proof directly from the owner.
      </p>

      <h2>Your authorization</h2>
      <p>
        After payment you give written authorization for us to contact websites, search engines, one listing agent or brokerage, and
        the applicable MLS contact on your behalf about the home&apos;s listing content. You can withdraw it by telling us in writing;
        we&apos;ll stop making new requests, and refunds follow the <Link className="text-link" href="/refunds">refund policy</Link>.
      </p>

      <h2>What we can and can&apos;t promise</h2>
      <ul>
        <li>We do the work described, during a {offer.serviceDays}-day window from completed onboarding, with weekly updates, a final report, and a day-{offer.recheckDay} recheck.</li>
        <li>Each website and listing source decides whether and when to act. We don&apos;t control them and can&apos;t guarantee that any particular content will be removed, hidden, or stay that way.</li>
        <li>We are not affiliated with any website named on this site.</li>
        <li>We don&apos;t provide legal advice.</li>
      </ul>

      <h2>Owner steps</h2>
      <p>
        Some sites only accept certain actions from the owner. We&apos;ll explain what&apos;s needed. If an owner step isn&apos;t
        completed, we may not be able to finish that part of the work, and we&apos;ll note it in your report.
      </p>

      <h2>Street View</h2>
      <p>
        If you separately consent, we guide you through Google&apos;s house-blur request. Google decides whether to apply it, and a blur,
        once applied, is permanent. This optional step does not count toward the result described in the refund policy.
      </p>

      <h2>Payment and refunds</h2>
      <p>
        Payment is taken through Stripe at the price shown at checkout. Refunds follow the{" "}
        <Link className="text-link" href="/refunds">refund policy</Link>.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our total liability for the service is limited to the fee you paid. [Final liability wording to
        be confirmed before launch.]
      </p>

      <h2>Governing law</h2>
      <p>[To be confirmed before launch.]</p>

      <h2>Contact</h2>
      <p>{c.email ? <a className="text-link" href={`mailto:${c.email}`}>{c.email}</a> : "Reply to any email from us."}</p>
    </LegalPage>
  );
}
