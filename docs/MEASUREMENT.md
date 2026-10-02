# Measurement

The site counts seven funnel steps in its own database (`funnel_events`). No third-party analytics, cookies, session replay, or ad pixels.

| Event | Source | Counted once per |
| --- | --- | --- |
| `cta_primary_click` | Browser beacon, with location (`header`, `hero`, `pricing`, `final`, `sticky`) | click |
| `eligibility_started` | Browser beacon on first interaction with the form | page visit |
| `eligibility_submitted` | Server, after a valid request is saved | inquiry |
| `eligibility_approved` | Server, when the operator approves | inquiry |
| `checkout_started` | Server, when a checkout session is created | checkout session |
| `purchase_confirmed` | Server, when a verified payment creates an order | order |
| `agent_inquiry` | Server, after an agent inquiry is saved | inquiry |

Each row holds the event name, the location (button clicks only), the launch mode, a test flag, a timestamp, and for server events an internal record id used only to prevent double counting. Browser events accept only the names and locations listed above; anything else is dropped. Purchases are counted from confirmed server events only, never from a checkout redirect, and a unique index makes duplicates impossible.

## Reading the numbers

```bash
npm run ops -- funnel                 # live data only
npm run ops -- funnel --include-test  # include preview/test events
```

It prints the counts plus:

- **Submitted to approved** = `eligibility_approved / eligibility_submitted`
- **Eligibility-to-purchase conversion** = `purchase_confirmed / eligibility_approved`. This is the number to watch: of the homes you said yes to, how many paid.
- **Refunds** = refunded orders out of all non-test orders.

The same figures appear in `/admin`. Equivalent SQL:

```sql
SELECT name, COUNT(*) FROM funnel_events WHERE is_test = 0 GROUP BY name;

SELECT
  1.0 * SUM(name = 'purchase_confirmed') / NULLIF(SUM(name = 'eligibility_approved'), 0) AS approved_to_paid
FROM funnel_events WHERE is_test = 0;

SELECT status, COUNT(*) FROM orders WHERE is_test = 0 GROUP BY status;
SELECT refund_reason, refunded_at FROM orders WHERE status = 'refunded' AND is_test = 0;
```

## Caveats

- Approvals and purchases can fall in different weeks, so read conversion over a cohort (for example, approvals in a month and whether each was paid) once volume allows. With the first handful of customers, look at each case individually rather than at percentages.
- Browser beacons can be blocked; click and start counts are a floor, not an exact figure.
- Record each refund's reason. The assurance refund (no verified result by day 45) and an early change-of-mind refund mean different things for the business.
