import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { coveredSitesSentence, offer } from "@/config/offer";

export const metadata: Metadata = {
  title: "What's covered",
  description: "Exactly what the $499 Home Privacy Cleanup service includes, what it doesn't, and how results are verified.",
  alternates: { canonical: "/scope" },
};

export default function ScopePage() {
  return (
    <LegalPage title="What's covered" intro={`One price, ${offer.priceLabel}, for one home. Here is exactly what that includes and what it doesn't.`}>
      <h2>Which homes qualify</h2>
      <ul>
        <li>One residence that is not listed for sale or rent right now.</li>
        <li>You own it, or you&apos;re authorized by the owner to act for them.</li>
        <li>We find listing photos, floor plans, or virtual tours of it that appear eligible for removal or public suppression.</li>
      </ul>
      <p>
        We check eligibility before you pay. If a home doesn&apos;t qualify, we tell you why, and nothing is charged. We&apos;re starting with
        homes in {offer.serviceArea}.
      </p>

      <h2>Where we look</h2>
      <p>
        We audit {coveredSitesSentence}. If the audit finds your listing content on other public websites, we add up to{" "}
        {offer.additionalSitesLimit} of them. Each website or image host counts as its own destination.
      </p>

      <h2>What we work on</h2>
      <ul>
        <li>Public listing photos, floor plans, and virtual tours of the home.</li>
        <li>Requests to remove them, or to stop showing them publicly, using each destination&apos;s available route.</li>
        <li>Contact with one listing agent or brokerage, and the applicable MLS contact when we can identify them. Asking for a listing to be hidden from public view is different from deleting the MLS&apos;s internal records, which we don&apos;t ask for.</li>
      </ul>

      <h2>Timing and reporting</h2>
      <ul>
        <li>{offer.serviceDays} days of active requests and follow-up, counted from the day your onboarding is complete.</li>
        <li>An email update every week during that time.</li>
        <li>A final report at the end of the window.</li>
        <li>A recheck around day {offer.recheckDay}, also counted from completed onboarding.</li>
      </ul>
      <p>
        The service window is how long we actively work, not a deadline by which everything will be gone. Websites decide when and
        whether they act, and the original listing source and each site&apos;s rules can affect what they will hide.
      </p>

      <h2>How we verify results</h2>
      <p>
        We check each destination ourselves and keep dated before-and-after evidence. A request we submitted is not counted as a
        result, and neither is a page that simply fails to load. Your report labels each destination as request submitted, verified
        removed, verified suppressed (no longer shown publicly), or still visible.
      </p>

      <h2>What you may need to do</h2>
      <p>
        You complete a short onboarding form with your written authorization. Some websites only accept certain actions from the
        owner, such as claiming the home or confirming ownership. When that happens, we tell you exactly what&apos;s needed. We aim to
        keep these steps few, but we can&apos;t promise there will be none. We never ask for your passwords.
      </p>

      <h2>Optional: Google Street View blur</h2>
      <p>
        With your separate consent, we guide you through Google&apos;s own request to blur your house in Street View. Google requires
        steps only the owner can complete, including proof of address. Once applied, the blur is permanent. Other map services are not
        part of the standard package.
      </p>

      <h2>What this service does not do</h2>
      <ul>
        <li>Erase the address, public records, sale history, or tax information.</li>
        <li>Remove exterior photos generally, or satellite imagery.</li>
        <li>Delete internal MLS records.</li>
        <li>Remove every copy on the internet, including sites outside the covered list and the additional sites we identify.</li>
        <li>Remove information from people-search or data-broker websites.</li>
        <li>Monitor the home after the day-{offer.recheckDay} recheck.</li>
        <li>Guarantee that any particular site will remove or hide content, or that content will never return.</li>
      </ul>
    </LegalPage>
  );
}
