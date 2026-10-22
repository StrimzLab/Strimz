---
date: 2026-10-22
feature: Public pages describe the outcome, not the network
scope: fix
scenario-impact: none
---

# Public pages describe the outcome, not the network

Closes #349.

Cross-chain payments are coming, so the public site stops leading with "Arc". It says what the merchant gets: USDC and EURC, in their own wallet, in seconds, with an on-chain receipt.

## What shipped

- **Homepage:** "settles on Arc" is gone from the manifesto, How it works and Assurances.
  - The hero scenes read "Confirming payment" and "Settled to your wallet".
- **FAQ:** two answers no longer name the network.
  - The network fee answer now says Strimz pays the network fee, and that refunds and withdrawals cost a small fee in USDC.
  - The answer about paying from another chain still says customers pay on Arc today, and that other networks are coming.
- **Use cases:** the Global B2B line and the invoice mock no longer name Arc.
- **About:**
  - The metadata and three cards are reworded.
  - The fact "Arc · the network payments settle on" becomes "1 · approval covers every renewal".
  - The finality card says a settled payment is final on-chain.
- **Footer:** "settled in USDC and EURC."
- **Site metadata:**
  - The default description, OpenGraph and Twitter text now match the homepage's business wording.
  - The "Arc" keyword is replaced with "EURC".
  - The share-image alt text no longer mentions Arc or "One API".
- **Guard:** `marketing-network-name.test.ts` fails if "Arc" returns to the marketing pages, the footer or the metadata. It allows only the one FAQ answer about where customers pay today.

## Not changed

- The Terms of Service, which name Arc as a legal fact.
- Checkout network prompts and receipts, dashboard withdraw and test mode, and the developer docs. Users act on those.
- The share image itself (`public/thumbnail.png`). It doesn't say Arc.
