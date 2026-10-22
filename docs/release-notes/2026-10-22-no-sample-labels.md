---
date: 2026-10-22
feature: No "Sample" labels on marketing and sign-in pages
scope: fix
scenario-impact: none
---

# No "Sample" labels on marketing and sign-in pages

Closes #356.

## What shipped

- **Sign-in panel:** the cards beside the login and signup forms no longer carry a **Sample** tag.
- **Homepage analytics mock:** the caption "Sample figures. Yours come from your own payments." is removed.
- **Use cases:** the worked example's row reads **If you bill** instead of **Sample**.
- **Developer band:** screen readers hear "code example" instead of "code sample".
- **Guard:** `marketing-no-sample-labels.test.ts` fails if "Sample", "Sample data", "Sample figures" or a "Live" label comes back on marketing or sign-in pages.

## Not changed

- The dashboard's **Live** mode: the Test / Live switch, live keys, onboarding and the storefront button. The maintainer kept these, because they name real payments.
