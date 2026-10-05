# Data handling

## What is stored, and where

Everything lives in one SQLite-compatible database: a hosted Turso database in production (`DATABASE_URL`), a local file (`DATABASE_PATH`) in development. Nothing personal is kept in browser storage, URLs, analytics, or application logs.

| Table | Contents | Personal data |
| --- | --- | --- |
| `inquiries` | Eligibility requests: address, name, email, optional phone, relationship statement, listing status and links, notes, consents, review decision | Yes |
| `checkouts` | Checkout sessions: provider, session id, status, amount | No (linked to an inquiry) |
| `orders` | Paid orders: payment reference, typed authorization name and time, listing agent notes, Street View consent, service dates, refunds | Yes |
| `agent_inquiries` | Agent name, email, brokerage, message | Yes |
| `email_outbox` | Copy of every email sent or held, including links | Yes |
| `webhook_events` | Stripe event ids already processed | No |
| `funnel_events` | Anonymous step counts (see MEASUREMENT.md) | No |
| `rate_limits` | Hashed (salted) connection keys and counters | No |

Customer links use 256-bit random tokens. Only SHA-256 hashes are stored. Card numbers never reach this app; Stripe collects them. Platform passwords are never requested.

Server logs contain only record ids, event types, and error names.

## Access

- `/admin` requires `ADMIN_PASSWORD`. Sessions are signed, HttpOnly, SameSite=Strict cookies scoped to `/admin`, valid for 12 hours. Login attempts are rate limited.
- The command line (`npm run ops`) requires shell access to the server.
- Private pages (`/c/...`, `/admin`) send `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex`.

## Retention (enforced by `npm run ops -- purge`)

Periods are set in `src/config/offer.ts` and published on the privacy page.

| Record | Deleted after |
| --- | --- |
| Declined or actively-listed inquiries | 90 days since last update |
| Approved or pending inquiries that never became orders | 180 days since last update |
| Agent inquiries | 365 days |
| Email outbox copies | 90 days |
| Paid orders and their inquiries | Not purged automatically (business records). Set the period before launch. |

Use `npm run ops -- purge --dry-run` to preview. Schedule the real command daily.

## Deletion requests

- Unpaid inquiry: `npm run ops -- delete HPC-XXXXXX` or the delete control in `/admin`. Removes the inquiry, its checkouts, and its email copies.
- Paid order: business and tax records may need to be kept. To minimize, clear the free-text fields by hand (`notes`, `owner_notes`, `listing_agent`, phone, `listing_links`) with a SQL update and record what was kept and why. Decide the exact policy before launch.

## Later documents

The MVP collects no uploads. If proof-of-address or similar documents are needed later (for example for an owner-led Street View request), keep them outside the web root in restricted private storage, link them by id only, and add them to the retention table above before collecting any.

## Unconfirmed items

Order retention period, hosting provider name, and email provider are listed in docs/LAUNCH_CHECKLIST.md.
