<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Offer facts (price, scope, assurance, retention) live only in `src/config/offer.ts`. Do not hardcode them elsewhere.
- Never invent contact details, testimonials, customer counts, success rates, partnerships, or response times. Missing facts stay missing and block sales mode.
- Do not use the em dash character in copy or docs.
- Keep personal data out of logs, URLs, analytics, and API responses. `tests/privacy.test.ts` checks this.
- Run `npm run check` before committing.
