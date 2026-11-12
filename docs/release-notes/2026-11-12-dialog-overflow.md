---
date: 2026-11-12
feature: Dialogs stay inside their card with long links
scope: fix
scenario-impact: none
---

# Dialog width

The "Payment link ready" dialog spilled past the right edge of its card: the long checkout
link widened the dialog's layout column, and the description and buttons followed it.

The shared dialog now keeps its column to the card's width, so a long link is truncated in
place. This applies to every dialog, including those showing API keys, webhook secrets and
wallet addresses.
