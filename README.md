# Home Privacy Cleanup

Public website and purchase flow for Home Privacy Cleanup: a $499, one-time managed service that finds old listing photos, floor plans, and virtual tours of an off-market home, requests removal or public suppression, follows up for 45 days, and verifies the results.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS 4, SQLite through Node's built-in `node:sqlite`, Stripe Checkout, and Resend for email.

## Run it locally

Requires Node.js 22.13 or later.

```bash
npm install
cp .env.example .env.local     # then set ADMIN_PASSWORD and SESSION_SECRET
npm run dev                    # http://localhost:3000
```

The site starts in **preview** mode: the full sales experience with test data, a simulated test payment, and email held in an outbox instead of being sent.

To try the whole purchase path in preview:

1. Open `/start`, click **Fill with test details**, and send the request.
2. Approve it, either at `/admin` (sign in with `ADMIN_PASSWORD`) or with `npm run ops -- approve HPC-XXXXXX`. Both give you the customer's secure link.
3. Open the link, continue to the test payment, and complete it (or try cancel and declined card).
4. Fill in the onboarding form. The 45-day window and day-60 recheck start there.
5. Read every email the customer would have received under **Recent email** in `/admin`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | Test suite (Vitest) |
| `npm run typecheck` | Generate route types and run TypeScript |
| `npm run lint` | ESLint |
| `npm run check` | All three of the above |
| `npm run ops -- <command>` | Operator tasks: `list`, `show`, `approve`, `decline`, `refund`, `delete`, `purge`, `funnel`, `readiness`. See `scripts/ops.ts`. |

## Launch modes

Set `LAUNCH_MODE` and restart the server. No rebuild is needed; mode is read at request time.

| Mode | What visitors see | Payments |
| --- | --- | --- |
| `preview` (default) | Full sales flow with a "Preview site" banner. Records are marked as test data. | Simulated on-site test payment, or Stripe test mode if an `sk_test_` key and webhook secret are set. Live keys are never used. Email is never sent. |
| `interest` | Real inquiries. The banner, buttons, and form say paid ordering isn't open yet. | None. Approved customers are told ordering isn't open. |
| `sales` | Paid ordering after eligibility approval. | Stripe Checkout, confirmed only by a verified webhook. |

Sales mode only takes effect when every item in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) is met. Otherwise the site runs in interest mode, so nothing pretends a purchase is possible. In development, a yellow status bar at the top lists exactly what's missing; `npm run ops -- readiness` shows the same list anywhere.

## Where to edit things

- **Price, scope, service window, assurance wording, retention periods:** `src/config/offer.ts`
- **Contact identity, mode, keys:** environment variables (`.env.example`)
- **Homepage copy:** `src/app/page.tsx`; FAQ in `src/content/faq.ts`
- **Legal pages:** `src/app/{scope,privacy,terms,refunds}/page.tsx`
- **Emails:** written inline in `src/lib/eligibility.ts`, `src/lib/payments.ts`, and `src/lib/onboarding.ts`; layout in `src/lib/email.ts`

## How the purchase flow works

1. **Intake** (`/start`): address, name, email, ownership or authorization statement, listing status, optional links and phone. Server-side validation, rate limiting, a honeypot field, and a signed form timer. No account, no uploads.
2. **Routing:** homes listed right now are told immediately that they aren't eligible yet. Everything else waits for manual review. No automatic exposure scan runs.
3. **Review:** the operator approves or declines in `/admin` or the CLI. Approval creates a long random customer link (only its hash is stored) and emails it.
4. **Checkout:** the server creates a Stripe Checkout session for the amount in `offer.ts`. The success redirect only shows "confirming payment".
5. **Confirmation:** a signed `checkout.session.completed` (or `async_payment_succeeded`) webhook creates the order. Duplicate and concurrent webhooks produce exactly one order, one email, and one purchase count. Amount mismatches are rejected.
6. **Onboarding:** the customer signs the written authorization (typed name) and can separately opt in to a Street View blur request (unchecked by default). The service clock starts here.

## Stripe setup

1. Create a webhook endpoint at `https://<your-site>/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
2. Put the secret key and the endpoint's signing secret in `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. To rehearse locally with Stripe test mode: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the `whsec_` it prints.

## Hosting notes

The database is a single SQLite file, so the app needs a host with a persistent disk (for example a small VPS, or a container platform with a mounted volume). Serverless platforms with ephemeral filesystems are not suitable without moving storage to a hosted database. Run `npm run ops -- purge` daily (cron) to apply the retention periods. Back up the database file.

## More documentation

- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): what must be true before accepting paid orders
- [docs/HOMEPAGE_COPY.md](docs/HOMEPAGE_COPY.md): the proposed live homepage copy in one place
- [docs/MEASUREMENT.md](docs/MEASUREMENT.md): funnel events and how to read conversion and refunds
- [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md): what's stored, where, for how long, and how to delete it
