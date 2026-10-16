---
'@strimz/sdk-react': patch
---

`checkoutOrigin` now defaults to `https://www.strimz.finance`, the host that serves the checkout. On 0.3.0 the default `https://strimz.finance` redirects to `www`, so `onSuccess` and `onError` never fired: upgrade, or pass `checkoutOrigin="https://www.strimz.finance"`. A `checkoutOrigin` with a path, query or hash now throws instead of building a broken checkout URL; a trailing slash is accepted.
