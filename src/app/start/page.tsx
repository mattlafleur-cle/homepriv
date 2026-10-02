import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { EligibilityForm } from "@/components/EligibilityForm";
import { effectiveMode } from "@/config/site";
import { offer } from "@/config/offer";
import { issueFormToken } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Check your home's eligibility",
  description: `Tell us about your home. We review eligibility before anything is charged. ${offer.priceLabel} once for one home.`,
  alternates: { canonical: "/start" },
};

export default function StartPage() {
  const mode = effectiveMode();
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="main" className="container-page grid gap-12 py-10 md:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">Step 1 of 3</p>
          <h1 className="mt-3 text-[2.2rem] font-medium sm:text-[2.75rem]">Tell us about your home</h1>
          <p className="mt-4 text-[1.1rem] text-muted">
            A few questions about the home and how to reach you. A person reviews every request before payment, so you
            won&apos;t be charged for a home we can&apos;t help.
          </p>
          <ul className="mt-6 space-y-3 text-[0.975rem]">
            <li className="flex gap-3"><span className="font-semibold text-evergreen">{offer.priceLabel}</span><span className="text-muted">once, for one home, only after approval{mode === "interest" ? " and once ordering opens" : ""}.</span></li>
            <li className="text-muted">No account to create and nothing to upload now.</li>
            <li className="text-muted">We never ask for passwords to property websites.</li>
          </ul>
        </div>
        <div className="max-w-2xl">
          <EligibilityForm formToken={issueFormToken()} mode={mode} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
