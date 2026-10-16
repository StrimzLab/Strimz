# ADR: www.strimz.finance is the one checkout origin

- **Status:** Accepted (approved by the maintainer, 2026-10-16)
- **Date:** 2026-10-16
- **Issue:** #291
- **Scope:**
  - `@strimz/sdk-react` (published, patch bump).
  - React SDK docs and README.
  - `infra/lightsail/env.example`, plus one production env value on the API.
  - No web app, database or contract change.

## Context

Checked against `main` at `8383481`.

1. **The default origin redirects.**
   - `StrimzProvider` defaults `checkoutOrigin` to `https://strimz.finance` (`provider.tsx:31`).
   - Vercel answers `308` on that host and sends every path to `https://www.strimz.finance`
     (checked today on `/pay/test`; `www` answers `200`).
   - The popup or iframe therefore runs on `www`. `readCheckoutResult` compares `ev.origin`
     with the apex and drops every result (`checkout-message.ts:11`).
   - A merchant on the defaults of 0.3.0 never gets `onSuccess` or `onError`. `onCancel` still
     fires when the popup closes, through polling.
2. **A path or trailing slash builds a broken URL.**
   - `checkoutUrl` appends `/pay/{id}` to the raw prop (`checkout-message.ts:23`).
   - `https://www.strimz.finance/` gives `//pay/{id}`; `https://www.strimz.finance/pay` gives
     `/pay/pay/{id}`.
   - The comments in `useStrimzCheckout.ts:35` and `StrimzCheckoutEmbed.tsx:43` say the prop
     "may carry a path", which invites exactly that.
3. **The API builds `checkoutUrl` from `CHECKOUT_ORIGIN`.**
   - `payment-sessions.service.ts:111`, `invoices.service.ts:195` and `storefronts.service.ts:235`.
   - If production holds the apex, every hosted link takes a redirect hop. Links still work, so
     this is tidiness, not a bug.
   - `infra/lightsail/env.example:56` shows `http://your-lightsail-hostname`, but the checkout
     is served by Vercel, not Lightsail.
4. Since #154 the docs and README already use `www` everywhere and tell merchants to pass
   `checkoutOrigin="https://www.strimz.finance"`.

## Options considered

1. **SDK default becomes `www`.** Needs a patch release. Merchants on 0.3.0 must upgrade or set the
   prop.
2. **Apex becomes primary on Vercel**, `www` redirects to it. Fixes 0.3.0 with no release, but
   every doc, README and sample from #154 would move back to the apex, and a merchant who
   followed the README (`www`) would break instead.
3. **Both**: pick a canonical host and pin the SDK to it.

## Decision

Option 1, with the input made strict so this can't recur.

1. **Default origin.** `StrimzProvider` defaults `checkoutOrigin` to `https://www.strimz.finance`.
   Vercel stays as it is: `www` primary, apex redirects.
2. **Origin only, checked once.** The provider parses `checkoutOrigin` with `new URL`:
   - a trailing `/` is accepted and dropped, so the context always holds the bare origin;
   - a path, query or hash throws on first render, with a message naming the prop, the same way
     the provider already rejects a secret key;
   - a value that isn't a URL throws too.
   - `checkoutOriginOf` stays as the single place that turns the prop into an origin.
3. **Comments.** The two "may carry a path" comments are removed; the code no longer needs them.
4. **Docs.** README and `docs/sdks/react.mdx` show the new default and say "origin only". The
   README's "Not yet … #291" note is removed. Explicitly passing `www` stays valid.
5. **API env.** `infra/lightsail/env.example` sets `CHECKOUT_ORIGIN=https://www.strimz.finance`.
   Operator step: set the same value on the production API container if it differs.
6. **Release.** Patch changeset for `@strimz/sdk-react`. The changelog line tells 0.3.0 users to
   upgrade or pass the prop.

```
merchant page ──StrimzProvider(checkoutOrigin?)──► new URL(...) ─┬─ path/query/hash → throw
                                                                 └─ origin "https://www.strimz.finance"
            ├─ checkoutUrl  → https://www.strimz.finance/pay/{id}?popup=1&parent=…
            └─ readCheckoutResult accepts ev.origin === "https://www.strimz.finance"
```

## Trade-offs

- A merchant who passed a path today gets a render error instead of a silently broken popup. Their
  integration was already broken (`/pay/pay/{id}`), so failing loudly is the better outcome.
- Merchants on 0.3.0 with defaults stay broken until they upgrade. Option 2 would avoid that, but
  0.3.0 shipped today and the README already tells them to pass `www`.
- If the canonical host ever moves to the apex, it is a one-line default change and a Vercel
  setting, the same as now.

## Tests (red first)

In `packages/sdk-react/tests`:

1. With no `checkoutOrigin`, `StrimzPayButton` opens `https://www.strimz.finance/pay/{id}?popup=1…`.
2. With no `checkoutOrigin`, a success message from `https://www.strimz.finance` fires `onSuccess`.
3. `checkoutOrigin="https://www.strimz.finance/"` opens `…/pay/{id}`, not `//pay/{id}`.
4. `checkoutOrigin` with a path (`/pay`), a query or a hash throws, and so does `"not a url"`.
