import { offer, coveredSitesSentence } from "@/config/offer";

/** Homepage FAQ. Answers must stay within what the service actually does. */
export function faqItems(opts: { assuranceConfirmed: boolean }) {
  return [
    {
      q: "Can't I do this myself?",
      a: [
        "Yes, some of it. Several property websites let a verified owner hide photos or ask for removal, and you're welcome to use those tools on your own.",
        `What you're paying for is the managed process: finding copies across the covered sites, using the right route for each one, contacting the original listing source when that's needed, following up for ${offer.serviceDays} days, and checking the results with dated evidence. If you'd rather handle it yourself, we understand.`,
      ],
    },
    {
      q: "Which websites do you cover?",
      a: [
        `We check ${coveredSitesSentence}. If our audit turns up your listing content on other public websites, we include up to ${offer.additionalSitesLimit} more. Each website counts as its own destination.`,
        "We also contact one listing agent or brokerage and the applicable MLS contact when we can identify them, because some sites take their photos from the original listing.",
      ],
    },
    {
      q: "How long does it take?",
      a: [
        `Your service window is ${offer.serviceDays} days from the day you finish onboarding. During that time we submit requests, follow up, and send you an update every week. You get a final report at the end and a recheck around day ${offer.recheckDay}.`,
        "Each website decides when, and whether, it acts on a request. Some respond quickly and some don't. The service window isn't a guarantee that everything will be gone by a certain date.",
      ],
    },
    {
      q: "What might still be visible afterward?",
      a: [
        "Some things are outside what this service can change: the address itself, public records such as sale history and tax data, exterior and satellite images, records inside the MLS, and copies on websites outside the covered list and the extra sites we identify.",
        "Some sites may also decline a request or keep some content. When that happens, your report says so plainly.",
      ],
    },
    {
      q: "Will I need to do anything?",
      a: [
        "After payment, you complete a short onboarding form that gives us written authorization to act for you.",
        "Some websites only accept certain steps from the owner, such as claiming the home on their site or confirming ownership. When that's the case, we tell you exactly what to do and why. We keep these steps to a minimum, but we can't promise there will be none. We never ask for your passwords.",
      ],
    },
    {
      q: "My home is listed for sale or rent right now. Can you help?",
      a: [
        "Not yet. Active listings are supposed to show photos, so we only work on homes that are off the market. Once the listing ends, you're welcome to send a request.",
      ],
    },
    {
      q: "Is this the same as blurring my house on Google Street View?",
      a: [
        "No. This service is about listing photos, floor plans, and virtual tours. Street View shows the outside of a home from the road.",
        "If you'd like, we can guide you through Google's own Street View blur request as an optional extra, with your separate consent. Google requires owner steps for this, and once Google applies a blur it is permanent and can't be undone. Other map services aren't part of the standard package.",
      ],
    },
    {
      q: "Can the photos come back?",
      a: [
        `Yes, it can happen. A new listing, a site update, or a copy from another source can bring content back. That's why we recheck around day ${offer.recheckDay} and report what we find. Ongoing monitoring after that isn't part of this package.`,
      ],
    },
    {
      q: "When do I get a refund?",
      a: opts.assuranceConfirmed
        ? [
            offer.assurance.beforeWork,
            offer.assurance.headline,
            "Partial success doesn't qualify for that refund, and a Street View blur on its own doesn't count as a result. The full terms are on the refund policy page.",
          ]
        : [
            "We're finalizing these terms before paid ordering opens. As proposed:",
            offer.assurance.beforeWork,
            offer.assurance.headline,
            "Partial success wouldn't qualify for that refund, and a Street View blur on its own wouldn't count as a result. The final terms will be on the refund policy page before anyone pays.",
          ],
    },
    {
      q: "What do you do with my information?",
      a: [
        "We use it to review your home, deliver the service, and keep records of what we did. We don't sell it, and we don't use advertising trackers or session recording on this site.",
        "Payments are handled by Stripe, so we never see or store your card number. You can ask us to delete your information. The privacy page explains what we keep and for how long.",
      ],
    },
  ];
}
