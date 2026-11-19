---
date: 2026-11-19
feature: Beta tester fixes for links, dialogs, checkout balance, onboarding and help links
scope: web
scenario-impact: none
---

# Beta tester fixes

- **Plan sign-up links work (#485).** The plan page built its sign-up link from the dashboard's own address (`app.strimz.finance/sub/…`), which returns 404 since checkout moved to its own app. The invoice "copy payment link" button had the same bug with `/pay/…`. Both now use the checkout address, and a test fails on any dashboard link that builds a checkout route from the dashboard's own origin.
- **Tall dialogs scroll on desktop (#486).** The New plan form ran past the bottom of a normal desktop screen with no way to reach Create. Every dialog now fits the screen, scrolls its contents, and keeps its action buttons pinned at the bottom.
- **An empty wallet gets a clear message at checkout (#487).** One-time checkout reads the payer's token balance once the wallet connects. While the wallet is short, Pay is disabled and the page says how much it holds and how much to add (for example, "This wallet has 0.00 USDC. Add 1.00 USDC to pay."). The balance refreshes every few seconds, so funding the wallet unlocks Pay without a reload. The payment hook checks again before asking for a signature, so "This checkout isn't available" is left for real outages.
- **Onboarding no longer shows the payout wallet (#488).** The address is still used to register the merchant and stays visible in Settings. A short "Setting up your Strimz wallet…" line shows while it's being prepared.
- **The "? Learn" help link stands out (#489).** It now uses the brand green in both themes, with a hover underline and a visible focus ring.
