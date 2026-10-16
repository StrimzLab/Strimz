---
date: 2026-10-16
feature: Marketing site, docs and SDK READMEs describe the product as it is today
scope: fix
scenario-impact: none
---

# Honest marketing and docs

Fixes #154. ADR: `docs/adr/ADR-2026-10-16-honest-marketing-and-docs.md` (and the for-dummies companion).

## What shipped

**Marketing site**

- **Stats band:** removed from Home, Customers and About ($48M, 12,400, 13s, 99.97%, "6 chains").
- **About:** shows facts instead: Arc, USDC and EURC, no gas for customers, no funds held. The "London and Lagos, hiring" line is gone.
- **Customers:**
  - The invented logo strip and the three invented stories with metrics are gone.
  - Three rewritten quotes are in the page, but the section renders only quotes that have a real name, role and company. It stays hidden until the maintainer adds approved customers.
- **Pricing:**
  - The threshold row is derived from `PLANS`.
  - Enterprise is "By contract", with no $1M figure.
  - "Most popular" becomes "Recommended".
  - Recovery emails and the cashflow digest are marked "(opt-in)".
- **FAQ:**
  - The real rate steps (0%, then 0.5%, then 0.4%).
  - Customers need a wallet: email and social login are off in checkout.
  - Merchants pay a little USDC gas for refunds and withdrawals.
  - Retries and the 48h lapse are stated correctly.
  - Cross-chain is "coming".
- **Call to action:** live mode opens at Arc mainnet. The "every feature" and "identity verification" claims are removed.
- **Copy fixes:**
  - The double-charge wording now describes the contract's due check.
  - Quarterly billing is added; the batching and latency claims are removed.
  - "Our database" replaces "your Postgres".
  - The dashboard preview has fixed dates, no `app.` subdomain, and a realistic retry time.
  - The footer typo is fixed.
- **Contact and legal:**
  - Unconfirmed inboxes point to support@. The PGP line is removed.
  - Terms no longer says "audited" and notes that live mode needs mainnet.
  - Privacy no longer implies government-ID collection, and lists Circle only for future cross-chain payments.
  - Acceptable use says screening is not part of checkout today.

**Docs** (about 60 pages) now follow the code:

- **Subscriptions:**
  - The first charge comes on the next 15-minute sweep, not at enrolment. Trials are for a payer's first subscription only.
  - Cancel is immediate only, and a payer can cancel on chain.
  - Retries back off 15m→24h, capped at 8. Grace is a fixed 48h, then the subscription lapses.
  - One charge per job, the real attempt-id formula, and `Duplicate` skips.
- **Webhooks:**
  - Retries at 1m, 5m, 30m and 2h. The timeout is 10s.
  - An endpoint is auto-disabled after 5 failures in 24h. Replay resets the attempt count to 1.
  - The event table shows the real `data` shapes.
- **Sessions:**
  - The real status names, and a 30-minute expiry.
  - The only list filter is `status`.
  - The webhook samples read `data.session`.
- **Refunds, storefronts and invoices:**
  - A refund signature is accepted only from `awaiting_signature`. A subscription product needs a `planId`.
  - The overdue-invoice job runs hourly. There is no public invoice page.
- **Errors:** the real codes. Rate limits are per IP.
- **Modes:** the real RPC URLs and the mainnet chain id 5042. `CONFIRMATIONS` is required, with 1 recommended.
- **Self-hosting the scheduler:** the real env vars.
- **Not live, so called "coming" or removed:**
  - Cross-chain routing.
  - Wallet screening and GitGuardian auto-revoke.
  - Brand colour, logo CDN and the hosted invoice page.
  - `Strimz-Version` pinning, `pause`/`resume`/`chargeNow`, `listAll` and the charge routes.
- **Four broken links are fixed.**
- Where a code bug makes today's behaviour differ, the page says so and links the issue: #291–#297.

**READMEs:** match each package's exports, published as a patch changeset.

- `@strimz/sdk-react` drops TanStack Query and documents the real hook shapes, peers and props. It recommends `checkoutOrigin="https://www.strimz.finance"` until #291.
- `@strimz/sdk` documents the browser client's namespaces, every error class, `/eip712` and the idempotency helpers.

**Repo rules:** AGENTS.md Directive 6, checklist item 14 and the engineering-standards skill now say comments stay minimal and human-sounding. Agents may shorten, correct or delete comments, but don't add unneeded ones. The stale subscription-premium comment in `shared-config/tiers.ts` is removed.

## Found while auditing, filed separately

- #291: the default `checkoutOrigin` redirects to www, so SDK results are dropped.
- #292: the API ignores idempotency keys, so SDK retries can duplicate POSTs.
- #293: the API cancel's on-chain call always reverts.
- #294: `refunds.create` in the SDK always throws.
- #295: documented events that are never sent, and no retry after a failed trial charge.
- #296: the SDK version header is always 0.0.0.
- #297: a failed charge retries every sweep, so the backoff and failure webhooks stop after the first.

## Operator steps

- Publish the patch changeset so npm shows the corrected READMEs.
- Add real, approved names to `TESTIMONIALS` in `apps/web/src/app/(marketing)/customers/page.tsx` to show the quotes.
- Confirm or create the sales@, security@, privacy@, legal@, compliance@ and abuse@ inboxes if you want them back.

## Verification

- **Red, then green:** on `174a3c8`:
  - `marketing-honesty.test.ts`: 17 of 17 failed;
  - `docs-links.test.ts` failed on the four broken links;
  - `pricing-plans.test.ts`: 2 new tests failed.
- **Results:**
  - web: 535 of 535;
  - `docs-code-samples.test.ts` passes;
  - `./scripts/preflight.sh` in full.
