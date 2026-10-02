import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CtaLink } from "@/components/CtaLink";
import { HeroDemo, IllustrativeTag, StatusPill, type Status } from "@/components/Illustrations";
import { StickyCta } from "@/components/StickyCta";
import { AgentForm } from "@/components/AgentForm";
import { Faq } from "@/components/Faq";
import { coveredSitesSentence, offer, termsConfirmed } from "@/config/offer";
import { effectiveMode, modeCopy, siteUrl } from "@/config/site";
import { faqItems } from "@/content/faq";
import { issueFormToken } from "@/lib/guard";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-1 h-5 w-5 flex-none text-evergreen" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity=".12" />
      <path d="M6 10.5l2.6 2.6L14 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dash() {
  return (
    <svg viewBox="0 0 20 20" className="mt-1 h-5 w-5 flex-none text-clay-ink" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity=".12" />
      <path d="M6.5 10h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SAMPLE_ROWS: { dest: string; found: string; request: string; checked: string; status: Status }[] = [
  { dest: "Listing site A", found: "32 photos and a floor plan", request: "Owner photo controls used, day 2", checked: "Day 9", status: "verified" },
  { dest: "Listing site B", found: "32 photos and a 3D tour", request: "Removal request day 3, follow-up day 10", checked: "Day 17", status: "removed" },
  { dest: "Listing site C", found: "30 photos", request: "Removal request day 3", checked: "Day 17", status: "submitted" },
  { dest: "Original brokerage website", found: "28 photos", request: "Asked the listing brokerage, day 4", checked: "Day 17", status: "submitted" },
  { dest: "Image search results", found: "6 interior photo copies", request: "Refresh request day 12", checked: "Day 19", status: "visible" },
];

const COMPARISON = [
  ["Finding copies", "Search each property site and image results yourself.", `We audit the covered sites, plus up to ${offer.additionalSitesLimit} more public websites we find.`],
  ["Making requests", "Learn each site's forms, rules, and owner steps.", "We prepare and submit the requests, and tell you if a step needs the owner."],
  ["The original listing", "Track down the listing agent or brokerage and ask for help.", "We contact one listing agent or brokerage and the MLS contact when identified."],
  ["Following up", "Remember to check back and ask again.", `${offer.serviceDays} days of active follow-up, with an update every week.`],
  ["Knowing it worked", "Rely on your own spot checks.", `Dated before-and-after evidence, a final report, and a recheck at day ${offer.recheckDay}.`],
] as const;

export default function Home() {
  const mode = effectiveMode();
  const { primaryCta, ctaSupport } = modeCopy(mode);
  const confirmed = termsConfirmed();
  const faqs = faqItems({ assuranceConfirmed: confirmed });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: offer.brandName,
    serviceType: "Removal and suppression requests for old real estate listing photos",
    description:
      "Managed discovery, removal or suppression requests, follow-up, and verification for public listing photos, floor plans, and virtual tours of one off-market home.",
    areaServed: { "@type": "Place", name: `${offer.serviceArea}, United States` },
    provider: { "@type": "Organization", name: offer.brandName, url: siteUrl() },
    url: siteUrl(),
    ...(mode !== "interest"
      ? {
          offers: {
            "@type": "Offer",
            price: (offer.priceCents / 100).toFixed(2),
            priceCurrency: "USD",
            description: "One-time fee for one eligible off-market residence. Eligibility is reviewed before payment.",
          },
        }
      : {}),
  };

  return (
    <>
      <SiteHeader />
      <main id="main">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

        {/* 1. Hero */}
        <section className="relative overflow-hidden">
          <div className="container-page grid items-center gap-12 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
            <div>
              <p className="eyebrow">Home photo removal, handled for you</p>
              <h1 className="mt-4 text-[2.4rem] font-medium sm:text-[3.1rem] lg:text-[3.6rem]">
                Your home is off the market. Its photos may still be online.
              </h1>
              <p className="mt-6 max-w-xl text-[1.15rem] leading-relaxed text-muted sm:text-[1.2rem]">
                Old listing photos can leave the inside of your home on public display. We find exposed photos, request removal,
                manage follow-ups, and check the results, so you don&apos;t have to manage the process yourself.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" id="hero-cta">
                <CtaLink location="hero">{primaryCta}</CtaLink>
                <Link href="#whats-included" className="btn-secondary">See what&apos;s included</Link>
              </div>
              <p className="mt-4 text-[0.975rem] font-medium text-ink">{ctaSupport}</p>
            </div>
            <HeroDemo />
          </div>
        </section>

        {/* 2. Problem recognition */}
        <section className="border-y border-line bg-paper" aria-labelledby="problem-title">
          <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <h2 id="problem-title" className="text-[2rem] font-medium sm:text-[2.5rem]">
                The listing ended. The photos didn&apos;t necessarily disappear.
              </h2>
            </div>
            <div className="space-y-5 text-[1.1rem] text-muted">
              <p>
                When a home sells or a rental is taken down, the listing usually changes status. The photos, floor plan, and
                virtual tour can stay attached to the property page, where anyone who searches the address can scroll through
                them.
              </p>
              <p>
                The same photos are often copied to several property websites, the original brokerage&apos;s site, and image
                search results. Each site has its own rules. Getting photos taken down on one doesn&apos;t necessarily take them
                down anywhere else.
              </p>
              <p className="text-ink">
                Not every home is affected. The way to know is to look, carefully, in all the places copies tend to end up.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Why hire us */}
        <section aria-labelledby="why-title">
          <div className="container-page py-16 md:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">Why hire us</p>
              <h2 id="why-title" className="mt-3 text-[2rem] font-medium sm:text-[2.5rem]">
                You can do some of this yourself. We take on the whole process.
              </h2>
              <p className="mt-5 text-[1.1rem] text-muted">
                Some websites let a verified owner hide photos or request removal, and you&apos;re welcome to use them. The
                work is everything around those tools: finding every copy, learning each site&apos;s route, reaching the
                original listing source, following up when nothing changes, and checking whether the photos are really gone.
                Your {offer.priceLabel} pays for us to manage that covered process from start to finish.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
              <table className="hidden w-full border-collapse text-left text-[0.975rem] md:table">
                <caption className="sr-only">Doing it yourself compared with having us manage it</caption>
                <thead>
                  <tr className="bg-sand/60">
                    <th scope="col" className="w-[22%] px-5 py-4 font-semibold">The job</th>
                    <th scope="col" className="px-5 py-4 font-semibold">On your own</th>
                    <th scope="col" className="bg-sage/70 px-5 py-4 font-semibold text-evergreen">With {offer.brandName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {COMPARISON.map(([job, diy, us]) => (
                    <tr key={job}>
                      <th scope="row" className="px-5 py-4 font-semibold">{job}</th>
                      <td className="px-5 py-4 text-muted">{diy}</td>
                      <td className="bg-sage/25 px-5 py-4">{us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {COMPARISON.map(([job, diy, us]) => (
                  <li key={job} className="p-5">
                    <h3 className="font-sans text-[1.05rem] font-semibold">{job}</h3>
                    <p className="mt-2 text-[0.95rem] text-muted"><span className="font-semibold text-ink">On your own: </span>{diy}</p>
                    <p className="mt-2 rounded-lg bg-sage/50 px-3 py-2 text-[0.95rem]"><span className="font-semibold text-evergreen">With us: </span>{us}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 4. Three steps */}
        <section id="how-it-works" className="bg-evergreen text-white" aria-labelledby="steps-title">
          <div className="container-page py-16 md:py-24">
            <p className="eyebrow !text-[#f0c9a6]">How it works</p>
            <h2 id="steps-title" className="mt-3 max-w-2xl text-[2rem] font-medium sm:text-[2.5rem]">Three steps, and you only do the first one.</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                {
                  t: "Tell us about your home",
                  d:
                    mode === "interest"
                      ? "Share the address and a few details. A person reviews it. Paid ordering isn't open yet, so nothing is charged."
                      : "Share the address and a few details. A person reviews it before you pay anything. If your home isn't a fit, we'll tell you.",
                },
                {
                  t: "We manage the cleanup",
                  d: `After payment, a short onboarding form collects your written authorization. Then we audit, submit requests, and follow up for ${offer.serviceDays} days, with a weekly update.`,
                },
                {
                  t: "See what changed",
                  d: `You get a final report with dated before-and-after evidence for every destination, then a recheck around day ${offer.recheckDay}.`,
                },
              ].map((s, i) => (
                <li key={s.t} className="border-t border-white/25 pt-6">
                  <span className="font-display text-[2.75rem] leading-none text-[#f0c9a6]" aria-hidden="true">{i + 1}</span>
                  <h3 className="mt-4 text-[1.4rem] font-medium">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.t}
                  </h3>
                  <p className="mt-3 text-white/85">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Offer */}
        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20">
          <div id="whats-included" className="container-page scroll-mt-24 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="eyebrow">One clear offer</p>
              <h2 id="pricing-title" className="mt-3 text-[2rem] font-medium sm:text-[2.5rem]">One home. One price. Paid once.</h2>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-[var(--radius-card)] border-2 border-evergreen bg-paper p-6 shadow-[0_24px_60px_-36px_rgba(31,74,61,0.6)] sm:p-9">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-semibold text-evergreen">{offer.brandName}</p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-[3.75rem] font-medium leading-none">{offer.priceLabel}</span>
                      <span className="text-muted">once</span>
                    </p>
                  </div>
                  <p className="rounded-full bg-sage px-3 py-1 text-[0.875rem] font-semibold text-evergreen">No subscription</p>
                </div>
                <p className="mt-4 text-muted">For one home that isn&apos;t listed for sale or rent. We confirm eligibility before you pay.</p>

                <h3 className="mt-8 font-sans text-[1rem] font-semibold">What&apos;s included</h3>
                <ul className="mt-3 space-y-3">
                  {[
                    `An audit of ${coveredSitesSentence}`,
                    `Up to ${offer.additionalSitesLimit} more public websites if the audit finds your listing content there`,
                    "Removal or public-suppression requests for listing photos, floor plans, and virtual tours on each site",
                    "Contact with one listing agent or brokerage, and the MLS contact when identified",
                    `${offer.serviceDays} days of active requests and follow-up, with an update every week`,
                    "A final report with dated before-and-after evidence",
                    `A recheck around day ${offer.recheckDay}`,
                    "Optional: guidance through Google's Street View house-blur request, only with your separate consent",
                  ].map((t) => (
                    <li key={t} className="flex gap-3">
                      <Check />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <CtaLink location="pricing" className="btn-primary w-full sm:w-auto">{primaryCta}</CtaLink>
                  <p className="mt-3 text-[0.95rem] text-muted">{ctaSupport}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[var(--radius-card)] bg-sand/70 p-6 sm:p-8">
                  <h3 className="font-sans text-[1rem] font-semibold">What this doesn&apos;t cover</h3>
                  <ul className="mt-3 space-y-3 text-[0.975rem]">
                    {[
                      "Erasing the address, public records, sale history, or tax data",
                      "Exterior or satellite images, and map services other than the optional Street View request",
                      "Records inside the MLS. Hiding a listing publicly is different from deleting it there",
                      "Every copy on the internet, people-search and data-broker sites, or monitoring after day 60",
                    ].map((t) => (
                      <li key={t} className="flex gap-3">
                        <Dash />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
                  <h3 className="font-sans text-[1rem] font-semibold">How we count a result</h3>
                  <p className="mt-3 text-[0.975rem] text-muted">
                    Only what we check ourselves. A request we sent, or a page that won&apos;t load, isn&apos;t proof. A result means
                    we independently confirmed the content is removed or no longer shown publicly, and we kept dated evidence.
                    Websites decide how and when they respond, and the original listing source can affect what they&apos;ll hide.
                  </p>
                  <p className="mt-3 text-[0.975rem]">
                    <Link className="text-link" href="/scope">Read the full scope</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Evidence */}
        <section className="border-y border-line bg-paper" aria-labelledby="evidence-title">
          <div className="container-page py-16 md:py-24">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <p className="eyebrow">What you&apos;ll see</p>
                <h2 id="evidence-title" className="mt-3 text-[2rem] font-medium sm:text-[2.5rem]">
                  We show our work instead of asking you to take our word for it.
                </h2>
              </div>
              <p className="self-end text-[1.1rem] text-muted">
                We&apos;re a new service, so we don&apos;t have customer reviews to show you yet. What we can show you is exactly how
                we report. Every destination gets its own line, its own dates, and an honest status.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sand/50 px-5 py-4">
                <div>
                  <p className="font-display text-[1.2rem] font-semibold">Final report, sample home</p>
                  <p className="text-[0.875rem] text-muted">Fictional rows. Not a real customer or outcome.</p>
                </div>
                <IllustrativeTag />
              </div>
              <div className="hidden grid-cols-[1.1fr_1.1fr_1.4fr_0.6fr_1fr] gap-4 border-b border-line px-5 py-3 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted md:grid" aria-hidden="true">
                <span>Destination</span>
                <span>Found at start</span>
                <span>Request</span>
                <span>Checked</span>
                <span>Status</span>
              </div>
              <ul className="divide-y divide-line">
                {SAMPLE_ROWS.map((r) => (
                  <li key={r.dest} className="grid gap-1.5 px-5 py-4 text-[0.95rem] md:grid-cols-[1.1fr_1.1fr_1.4fr_0.6fr_1fr] md:items-center md:gap-4">
                    <span className="font-semibold">{r.dest}</span>
                    <span className="text-muted"><span className="md:sr-only">Found at start: </span>{r.found}</span>
                    <span className="text-muted"><span className="md:sr-only">Request: </span>{r.request}</span>
                    <span className="text-muted"><span className="md:sr-only">Checked: </span>{r.checked}</span>
                    <span className="mt-1 md:mt-0"><StatusPill status={r.status} /></span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-wait-bg/50 px-5 py-4 text-[0.95rem]">
                <span className="font-semibold">Unresolved: </span>
                Image search still shows 6 copies, and two requests are waiting on a response. Each is listed with what we tried and
                when we&apos;ll check again.
              </div>
            </div>

            <dl className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                ["submitted", "We asked. Nothing is confirmed yet. A request on its own isn't counted as a result."],
                ["verified", "We checked independently, and the content no longer shows publicly. Some sites hide content rather than delete it. Removed means it's gone from that page."],
                ["visible", "The content is still public. We say so, along with what we tried and what happens next."],
              ].map(([s, d]) => (
                <div key={s} className="rounded-xl border border-line bg-ivory p-5">
                  <dt><StatusPill status={s as Status} /></dt>
                  <dd className="mt-3 text-[0.975rem] text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 7. Assurance */}
        <section aria-labelledby="assurance-title">
          <div className="container-page py-16 md:py-24">
            <div className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-10">
              {!confirmed && (
                <p className="mb-4 inline-flex rounded-full bg-wait-bg px-3 py-1 text-[0.875rem] font-semibold text-wait">
                  Proposed terms. Final wording is confirmed before paid ordering opens.
                </p>
              )}
              <p className="eyebrow">Service assurance</p>
              <h2 id="assurance-title" className="mt-3 text-[1.75rem] font-medium sm:text-[2.1rem]">
                If we can&apos;t show a result, you get your fee back.
              </h2>
              <p className="mt-5 text-[1.15rem] font-medium">{offer.assurance.headline}</p>
              <p className="mt-4 text-muted">{offer.assurance.beforeWork}</p>
              <ul className="mt-5 space-y-2 text-[0.975rem] text-muted">
                {offer.assurance.clarifications.map((c) => (
                  <li key={c} className="flex gap-3">
                    <Dash />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[0.975rem]">
                <Link className="text-link" href="/refunds">Read the refund policy</Link>
              </p>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section id="faq" className="border-t border-line bg-paper" aria-labelledby="faq-title">
          <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2 id="faq-title" className="text-[2rem] font-medium sm:text-[2.5rem]">Questions people ask</h2>
              <p className="mt-4 text-muted">Something else on your mind? Ask in your request and we&apos;ll answer before you pay.</p>
            </div>
            <Faq items={faqs} />
          </div>
        </section>

        {/* 9. Agents */}
        <section id="agents" className="bg-sand/60" aria-labelledby="agents-title">
          <div className="container-page grid gap-10 py-16 md:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className="eyebrow">For real estate agents</p>
              <h2 id="agents-title" className="mt-3 text-[1.75rem] font-medium sm:text-[2.1rem]">A closing gift for clients who value privacy.</h2>
              <p className="mt-4 text-muted">
                Your buyers may not realize the previous listing photos of their new home are still public. If you&apos;d like to
                offer this service as a closing gift, tell us a little about how you&apos;d use it. We&apos;ll reply about how it
                would work. The homeowner stays our client, and we review each home for eligibility the same way.
              </p>
            </div>
            <AgentForm formToken={issueFormToken()} />
          </div>
        </section>

        {/* 10. Final CTA */}
        <section aria-labelledby="final-title" id="final-cta">
          <div className="container-page py-16 text-center md:py-24">
            <h2 id="final-title" className="mx-auto max-w-3xl text-[2.1rem] font-medium sm:text-[2.75rem]">
              Find out what&apos;s still out there, and let someone else handle it.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[1.1rem] text-muted">
              Tell us about your home. We&apos;ll check eligibility before anything is charged, then manage the requests, the
              follow-up, and the proof.
            </p>
            <div className="mt-8 flex justify-center">
              <CtaLink location="final">{primaryCta}</CtaLink>
            </div>
            <p className="mt-4 font-medium">{ctaSupport}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta label={primaryCta} />
    </>
  );
}
