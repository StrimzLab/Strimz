---
date: 2026-10-22
feature: Homepage hero mock in business language
scope: fix
scenario-impact: none
---

# Homepage hero mock in business language

Closes #272 and #353.

The hero's headline, buttons and trust line already met #272 after #270. This finishes it by fixing the animated dashboard mock beside them.

## What shipped

- **Customer names, not wallets:** each scene names a customer (Brightline Studio, Halden & Co, Northwind GmbH) instead of a `0x…` address.
- **Plain chips:** the floating chip says what happened ("Renewal charged", "Payment received", "Payment recovered") instead of an event name like `subscription.charged`. The dark chip says "→ your wallet".
- **Confirming:** a short progress bar, "Confirming payment · a few seconds", replaces the block-number ticker.
- **Status:** "at risk" replaces `at_risk` and "1 at-risk".
- **No status label:** the "Live" badge in the mock header is removed.
- **Dark mode:** the failed and info timeline icons are readable.
- **Reduced motion (#353):** the mock reads the preference after hydration, with a server snapshot. The first client render now matches the server, so React no longer throws a hydration error. Visitors who prefer reduced motion still see each scene's final frame.

## Not changed

- The hero headline, rotating word, buttons and trust line.
- The scene timings and choreography.
