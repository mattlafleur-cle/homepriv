# Launch checklist

Sales mode stays locked (the site runs in interest mode) until the items marked **enforced** are met. Run `npm run ops -- readiness` to check them. The other items are not enforced by code but should be done before the first paid order.

## Enforced by the app

| # | Requirement | How it is checked | Status |
| --- | --- | --- | --- |
| 1 | Payments configured | `STRIPE_SECRET_KEY` (an `sk_live_` key in production) and `STRIPE_WEBHOOK_SECRET` set | Open |
| 2 | Durable storage | A hosted Turso `DATABASE_URL` with `DATABASE_AUTH_TOKEN` (or, self-hosted, `DATABASE_PATH` on a persistent disk with `DATABASE_DURABLE=true`) | Open |
| 3 | Transactional email | `RESEND_API_KEY` and a verified `EMAIL_FROM` sender | Open |
| 4 | Identified operator | `OPERATOR_NAME`, `ADMIN_PASSWORD` (12+ characters), `SESSION_SECRET` (32+ characters) | Open |
| 5 | Confirmed offer terms | `offerTermsConfirmedOn` and `legalPagesConfirmedOn` dates filled in `src/config/offer.ts` (also fill `confirmedBy`) | Open |
| 6 | Accurate contact identity | `CONTACT_EMAIL` and `BUSINESS_LEGAL_NAME` | Open |
| 7 | Public address | `SITE_URL` using https | Open |

## Facts to decide or confirm (not invented in the build)

- [ ] **Legal entity** that sells the service, and whether it is a new entity or an existing one. Goes in `BUSINESS_LEGAL_NAME` and the terms.
- [ ] **Domain** and **contact email**. A mailing address and phone are optional; publish only real ones.
- [ ] **Final assurance wording.** The proposed text is in `offer.assurance`. Confirm the two refund triggers (full refund before the first external request; service-fee refund if no identified target is verified removed or suppressed by day 45), that partial success does not qualify, and that Street View alone does not count.
- [ ] **Final price and scope** ($499, one residence, covered sites, up to 5 additional sites, 45-day window, weekly updates, final report, day-60 recheck).
- [ ] **Legal review** of `/terms`, `/privacy`, and `/refunds`. Two placeholders remain in the terms: liability wording and governing law.
- [ ] **Order record retention period** (privacy page currently says it will be stated before launch).
- [ ] **Hosting provider** name for the privacy page (`HOSTING_PROVIDER_NAME`).
- [ ] **Service area** wording. The site says it is starting with Northeast Ohio and does not claim wider coverage. Decide how to handle out-of-area requests (the decline reason `out_of_area` exists).
- [ ] **Sales tax.** Confirm whether this service is taxable where you sell it. Checkout currently charges a flat $499 with no tax line. If tax applies, enable Stripe Tax or adjust pricing before launch.
- [ ] Whether the business plan's **five free beta homes** run in preview mode (records marked test) or through manual handling outside the site.

## Operational readiness

- [ ] Stripe webhook endpoint created with the four `checkout.session.*` events, and a live test purchase refunded end to end.
- [ ] Email sender domain verified (SPF/DKIM) and a test message received in Gmail and Outlook.
- [ ] Database backups confirmed (Turso keeps point-in-time history; confirm what your plan includes) and one restore tested.
- [ ] Daily `npm run ops -- purge` scheduled.
- [ ] Review turnaround you can actually keep, decided before you promise any response time anywhere.
- [ ] Templates ready for weekly updates, the final report, and the day-60 recheck. (The site records dates; report delivery is handled by the operator.)
- [ ] `SITE_INDEXABLE=true` set only once the site is live in sales or interest mode on its real domain.

## Recording confirmation

When items in "Facts to decide" are done, record the date and who confirmed them in `src/config/offer.ts` (`termsConfirmation`) and commit the change. The commit is the record. Removing the "Proposed terms" and "Draft for review" labels happens automatically once both dates are set.
