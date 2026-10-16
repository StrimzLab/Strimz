---
date: 2026-10-16
feature: React SDK defaults to the checkout host that answers, www.strimz.finance
scope: fix
scenario-impact: none
---

# Canonical checkout origin

Fixes #291. ADR: `docs/adr/ADR-2026-10-16-canonical-checkout-origin.md` (and the for-dummies companion).

## What shipped

- **Default origin:** `StrimzProvider` defaults `checkoutOrigin` to `https://www.strimz.finance`. The apex redirects to `www`, so on 0.3.0 the SDK dropped every success and error message from the checkout.
- **Origin only:** the provider checks `checkoutOrigin` once.
  - A trailing `/` is dropped, so the URL is `/pay/{id}`, not `//pay/{id}`.
  - A path, query or hash, or a value that isn't a URL, throws on first render and names the prop.
- **Comments:** the two "may carry a path" comments in `useStrimzCheckout.ts` and `StrimzCheckoutEmbed.tsx` are removed. The hooks use the origin from the provider directly.
- **Docs:** the README and `docs/sdks/react.mdx` show the new default and say "origin only". The README's #291 note is gone.
- **Env example:** `infra/lightsail/env.example` sets `CHECKOUT_ORIGIN=https://www.strimz.finance`.
- **Changeset:** `@strimz/sdk-react` patch.

## Operator steps

- Publish the patch changeset.
- On the production API container, set `CHECKOUT_ORIGIN=https://www.strimz.finance` if it holds anything else, then restart it. Session `checkoutUrl`s then skip the redirect.

## Verification

- **Red, then green:** `packages/sdk-react/tests/checkoutOrigin.test.tsx` failed 8 of 8 on `8383481`, and now passes.
- **Results:**
  - sdk-react: 32 of 32;
  - `./scripts/preflight.sh` in full.
