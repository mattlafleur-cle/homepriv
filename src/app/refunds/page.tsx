import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { offer } from "@/config/offer";
import { contact } from "@/config/site";

export const metadata: Metadata = { title: "Refund policy", alternates: { canonical: "/refunds" } };

export default function RefundsPage() {
  const email = contact().email;
  return (
    <LegalPage title="Refund policy" intro="Plain terms for when you get your money back.">
      <h2>Before we start work</h2>
      <p>
        If you change your mind before we send the first request to any outside website, agent, brokerage, or MLS contact, we refund
        the full {offer.priceLabel}.
      </p>

      <h2>If we can&apos;t show a result</h2>
      <p>{offer.assurance.headline}</p>
      <ul>
        {offer.assurance.clarifications.map((c) => <li key={c}>{c}</li>)}
        <li>
          &quot;Day {offer.serviceDays}&quot; is counted from the day your onboarding is complete. &quot;Verified&quot; means we
          checked independently and kept dated evidence; a submitted request or a page that won&apos;t load doesn&apos;t count.
        </li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>
        Refunds go back to the original payment method through Stripe. Your bank decides how long it takes to appear on your
        statement.
      </p>

      <h2>How to ask</h2>
      <p>
        {email ? <>Email <a className="text-link" href={`mailto:${email}`}>{email}</a> or reply to any email from us</> : "Reply to any email from us"}{" "}
        with your order number. See also <Link className="text-link" href="/scope">what&apos;s covered</Link>.
      </p>
    </LegalPage>
  );
}
