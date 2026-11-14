---
'@strimz/sdk-react': minor
'@strimz/sdk': patch
---

The hosted checkout moved to its own host. `StrimzProvider`'s `checkoutOrigin` now defaults to `https://checkout.strimz.finance`, and only results from that origin are accepted unless you pass another one. Old `www.strimz.finance/pay/...` links redirect there. The README docs links, and the link in the browser-use error, point to `docs.strimz.finance`.
