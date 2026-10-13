import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { offer } from "@/config/offer";

export const metadata: Metadata = { title: "Request received", robots: { index: false, follow: false } };

/**
 * Where Stripe sends people after the card-hold step. Arriving here proves
 * nothing; the hold is recorded only from Stripe's signed webhook.
 */
export default async function HeldPage({ searchParams }: PageProps<"/start/held">) {
  const skipped = (await searchParams).skipped === "1";
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="main" className="container-page max-w-2xl py-10 md:py-16">
        <p className="eyebrow">Step 1 of 3</p>
        {skipped ? (
          <>
            <h1 className="mt-3 text-[2.2rem] font-medium sm:text-[2.6rem]">Your request is saved. No card hold was placed.</h1>
            <p className="mt-4 text-[1.1rem] text-muted">
              That&apos;s fine. We&apos;ll still review your home. If it qualifies, we&apos;ll email you a secure link to pay{" "}
              {offer.priceLabel}. If it doesn&apos;t, we&apos;ll tell you why. Nothing has been charged.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-[2.2rem] font-medium sm:text-[2.6rem]">Your card is on hold, not charged.</h1>
            <p className="mt-4 text-[1.1rem] text-muted">
              A person will review your home. If it qualifies, we charge the {offer.priceLabel} hold
              and email you a short onboarding form. If it doesn&apos;t, we release the hold and tell you why.
            </p>
            <p className="mt-4 text-muted">
              Your bank may show the hold as a pending charge. If we release it, your bank decides how long it takes to drop off.
            </p>
          </>
        )}
        <p className="mt-6 text-muted">We&apos;ve emailed you a confirmation with your reference number.</p>
        <p className="mt-8">
          <Link href="/" className="text-link">Back to the homepage</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
