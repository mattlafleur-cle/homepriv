# Launch checklist

Sales mode stays locked (the site runs in interest mode) until the items marked **enforced** are met. Run `npm run ops -- readiness` to check them. The other items are not enforced by code but should be done before the first paid order.

## Enforced by the app

| # | Requirement | How it is checked | Status |
| --- | --- | --- | --- |
| 1 | Payments configured | `STRIPE_SECRET_KEY` (an `sk_live_` or restricted `rk_live_` key in production) and `STRIPE_WEBHOOK_SECRET` set | Open |
| 2 | Durable storage | A hosted Turso `DATABASE_URL` with `DATABASE_AUTH_TOKEN` (or, self-hosted, `DATABASE_PATH` on a persistent disk with `DATABASE_DURABLE=true`) | Open |
| 3 | Transactional email | `RESEND_API_KEY` and a verified `EMAIL_FROM` sender | Open |
| 4 | Identified operator | `OPERATOR_NAME`, `ADMIN_PASSWORD` (12+ characters), `SESSION_SECRET` (32+ characters) | Open |
| 5 | Confirmed offer terms | `offerTermsConfirmedOn` and `legalPagesConfirmedOn` dates filled in `src/config/offer.ts` (also fill `confirmedBy`) | Open |
| 6 | Accurate contact identity | `CONTACT_EMAIL` and `BUSINESS_LEGAL_NAME` | Open |
| 7 | Public address | `SITE_URL` using https | Open |

## Facts to decide or confirm (not invented in the build)

- [x] **Legal entity:** Home Privacy Cleanup LLC. Set `BUSINESS_LEGAL_NAME` to exactly this once the LLC is registered with the Ohio Secretary of State.
- [x] **Domain** (homeprivacycleanup.com) and **contact email** (hello@homeprivacycleanup.com, forwarded). A mailing address and phone are optional; publish only real ones.
- [x] **Assurance wording** decided: full refund before the first external request; service-fee refund if no identified target is verified removed or suppressed by day 60 (the recheck). Partial success does not qualify; Street View alone does not count.
- [x] **Final price and scope** ($349 launch price, one residence, covered sites, up to 5 additional sites, 45-day window, weekly updates, final report, day-60 recheck).
- [x] **Legal review** of `/terms`, `/privacy`, and `/refunds`: reviewed and approved by counsel; confirmed 2026-10-12. Liability is capped at the fee paid and Ohio law governs.
- [x] **Order record retention period:** 7 years (`offer.retention.orderRecordYears`).
- [x] **Hosting provider** name for the privacy page (`HOSTING_PROVIDER_NAME=Vercel`).
- [ ] **Service area** wording. The site says it is starting with Northeast Ohio and does not claim wider coverage. Decide how to handle out-of-area requests (the decline reason `out_of_area` exists).
- [x] **Sales tax:** the operator determined Ohio sales tax does not apply to this service. Checkout charges a flat $349 with no tax line. Revisit if the service changes or sales extend to other states.
- [ ] **Example listing photos** (`src/assets/example/`). Record where each stock photo came from and its license. The house number and yard sign in the exterior photo are blurred; keep them blurred if the file is replaced.
- [ ] Whether the business plan's **five free beta homes** run in preview mode (records marked test) or through manual handling outside the site.

## Operational readiness

- [ ] Stripe webhook endpoint created with the four `checkout.session.*` events plus `payment_intent.canceled` (marks expired card holds), and a live test purchase refunded end to end.
- [ ] Card-hold test: submit a request, place the hold, approve it in /admin (charges the hold), then refund. Submit a second request, place the hold, decline it, and confirm the hold is released in Stripe.
- [ ] Review requests with a card hold within about 5 days. Holds usually expire around day 7 (Visa can be shorter); an expired hold falls back to a payment link.
- [ ] Email sender domain verified (SPF/DKIM) and a test message received in Gmail and Outlook.
- [ ] Database backups confirmed (Turso keeps point-in-time history; confirm what your plan includes) and one restore tested.
- [ ] Daily `npm run ops -- purge` scheduled.
- [ ] Review turnaround you can actually keep, decided before you promise any response time anywhere.
- [ ] Templates ready for weekly updates, the final report, and the day-60 recheck. (The site records dates; report delivery is handled by the operator.)
- [ ] `SITE_INDEXABLE=true` set only once the site is live in sales or interest mode on its real domain.

## Recording confirmation

When items in "Facts to decide" are done, record the date and who confirmed them in `src/config/offer.ts` (`termsConfirmation`) and commit the change. The commit is the record. Removing the "Proposed terms" and "Draft for review" labels happens automatically once both dates are set.
