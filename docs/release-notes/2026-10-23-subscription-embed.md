---
date: 2026-10-23
feature: Subscription plans get return URLs, the plan checkout reports its result to the page that opened it, and the React SDK adds a subscribe button, embed and hook
scope: feat
scenario-impact: needs_automation
---

# Subscribe button, embed and return URLs for plans

Fixes #288. ADR:
[ADR-2026-10-23-subscription-embed](../adr/ADR-2026-10-23-subscription-embed.md)
([plain-English version](../adr/ADR-2026-10-23-subscription-embed-for-dummies.md)).

## What shipped

- **Migration `20261023130000_subscription_plan_return_urls`.** It adds `successUrl TEXT NULL` and `cancelUrl TEXT NULL` to `SubscriptionPlan`.
- **`@strimz/shared-types` (minor).**
  - **Plans:** `subscriptionPlanSchema` gains `successUrl` and `cancelUrl`, and `createSubscriptionPlanInputSchema` takes them as optional.
  - **New `updateSubscriptionPlanInputSchema`:** strict; only the two URLs, at least one of them, `null` clears.
  - **New `subscriptionResultMessageSchema`:**
    - `strimz:subscription:success` carries `{ planId, subscriptionId | null, txHash }`.
    - `strimz:subscription:cancel` carries `{ planId }`.
    - `strimz:subscription:error` carries `{ planId, code, message }`, with codes `load_failed`, `merchant_not_ready`, `payment_reverted` and `already_subscribed`.
- **API.**
  - `POST /v1/subscription-plans` stores the URLs.
  - **New `PATCH /v1/subscription-plans/:id`** (`subscriptions_write`): changes only the URLs, on active or archived plans. Another merchant's plan answers 404.
  - The public `GET /v1/checkout/plans/:id` returns the URLs too.
- **`@strimz/sdk` (minor).** It gains `subscriptionPlans.update(id, { successUrl?, cancelUrl? })`.
- **`@strimz/sdk-react` (minor).**
  - **New exports:**
    - `useStrimzSubscribe`, which opens `/sub/{planId}`.
    - `<StrimzSubscribeButton planId />`.
    - `<StrimzSubscriptionEmbed planId />`.
    - `StrimzSubscriptionError`.
  - **Callbacks:** `onSuccess` gets `{ subscriptionId, txHash }`.
  - **Message checks:** a message counts only from the checkout origin, from the component's own popup or iframe, and for its plan.
  - **Shared popup code:** `useStrimzCheckout` and `useStrimzSubscribe` now share it (`useHostedPopup`). The pay button's styling moved to `button-style.tsx`, shared with the subscribe button.
- **Checkout `/sub/[planId]`.**
  - **Host parameters:** it reads `embed`, `popup` and `parent` with the same rules as `/pay`, and posts the subscription messages. Embed and popup never navigate.
  - **After the enrolment confirms:** it polls the public subscription-status endpoint every 2 s, for up to 30 s, for the new subscription's id. The receipt reads "Finishing up…" meanwhile. It then posts `success`.
  - **Full page:** it redirects to `successUrl` with `{SUBSCRIPTION_ID}` and `{ON_CHAIN_TX_HASH}` filled in.
  - **Cancel:** goes to `cancelUrl` on a full page; otherwise it posts `cancel`.
  - **Already subscribed:** a wallet that already subscribes posts `already_subscribed`.
- **Dashboard.**
  - **New-plan dialog:** optional Success URL and Cancel URL fields.
  - **Plan page:** an "After checkout" card with an Edit dialog, and a copyable `<StrimzSubscribeButton>` snippet under the sign-up link.
- **Docs.** The following pages are updated:
  - `subscriptions/plans`;
  - `sdks/react`;
  - `checkout/embed`;
  - `checkout/callbacks`;
  - `dashboard/plans`;
  - `api/subscriptions`;
  - the b2b-saas recipe;
  - both package READMEs.

## Operators

- **Migration:** apply it with the API deploy (`prisma migrate deploy`). Deploy the web app after the API, so the checkout reads the URLs from an API that returns them.
- **Packages:** they publish through the changeset in `.changeset/subscription-plan-embed.md`.
- **Configuration:** nothing new is needed.

## Verification

- **Red first:**
  - **Shared types:** `subscription-result-message.test.ts`.
  - **API e2e:** `subscription-plan-return-urls.e2e.test.ts`, 8 tests: create, defaults, PATCH set/keep/clear, archived plan, rejected fields and schemes, another merchant's plan, scope, public endpoint.
  - **Server SDK:** `subscription-plans.test.ts`.
  - **Web:** `subscription-result.test.ts` (17 tests: placeholders, messages, posting, cancel destination, id polling), the plan-input return URL tests, and the dashboard and `/sub` wiring tests.
  - **React SDK:** `useStrimzSubscribe.test.tsx` and `StrimzSubscriptionEmbed.test.tsx`.
- **Existing tests:** the `useStrimzCheckout` and embed tests still pass after the shared-hook refactor.
- `./scripts/preflight.sh` passed in full. API e2e passes.
