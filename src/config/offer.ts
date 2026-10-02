/**
 * The offer: price, scope, limits, and assurance wording.
 *
 * This file is the single place to edit what the service includes and what it
 * costs. Pages, emails, structured data, and checkout all read from here. The
 * checkout amount is taken from `priceCents` on the server, never from the
 * browser.
 *
 * Before paid ordering opens, record the final confirmation of these terms in
 * `termsConfirmation` (and in docs/LAUNCH_CHECKLIST.md). Sales mode stays
 * locked until both dates are filled in.
 */

export const offer = {
  brandName: "Home Privacy Cleanup",
  productName: "Home Privacy Cleanup, one residence",
  priceCents: 49_900,
  currency: "usd",
  priceLabel: "$499",

  /** Initial marketing focus. Do not describe wider coverage as established. */
  serviceArea: "Northeast Ohio",

  coveredSites: [
    "Zillow",
    "Redfin",
    "Realtor.com",
    "Trulia",
    "Homes.com",
    "Google Search and Google Images",
  ],
  additionalSitesLimit: 5,

  targetContent: ["listing photos", "floor plans", "virtual tours"],

  serviceDays: 45,
  recheckDay: 60,
  updateCadence: "weekly",

  /**
   * Proposed assurance. It is shown as "proposed" until termsConfirmation is
   * recorded, and sales mode cannot be enabled before then.
   */
  assurance: {
    headline:
      "If we cannot verify removal or public suppression of any identified target photo, floor plan, or virtual tour by day 45, we refund your service fee.",
    beforeWork:
      "Changed your mind before we send the first outside request? You get a full refund.",
    clarifications: [
      "This covers the case where nothing we identified is verified removed or suppressed. If some targets are cleared and others remain, that is partial success and does not qualify for this refund.",
      "Individual sites may keep showing some content. We cannot guarantee complete removal from every site.",
      "An optional Google Street View blur request does not count toward this result on its own.",
    ],
  },

  termsConfirmation: {
    /** ISO date the price, scope, service window, and refund terms were confirmed. */
    offerTermsConfirmedOn: null as string | null,
    /** ISO date the privacy policy, terms, and refund policy were reviewed and approved. */
    legalPagesConfirmedOn: null as string | null,
    confirmedBy: null as string | null,
  },

  /** Proposed retention periods. Shown on the privacy page; enforced by `npm run ops -- purge`. */
  retention: {
    declinedInquiryDays: 90,
    unpaidApprovedInquiryDays: 180,
    agentInquiryDays: 365,
  },
} as const;

export const coveredSitesSentence = `${offer.coveredSites.slice(0, -1).join(", ")}, and ${
  offer.coveredSites[offer.coveredSites.length - 1]
}`;

export function termsConfirmed() {
  return Boolean(
    offer.termsConfirmation.offerTermsConfirmedOn &&
      offer.termsConfirmation.legalPagesConfirmedOn,
  );
}
