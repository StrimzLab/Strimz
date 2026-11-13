---
date: 2026-11-12
feature: Invoice line-item headers fit on one line
scope: fix
scenario-impact: none
---

# Invoice line-item headers

On New invoice, the line-item header labels wrapped and overlapped. `Qty (required) *` and `Unit (USDC) (required) *` sat in 80px and 120px columns, and "Amount" sat higher than the rest.

- Header labels use sentence case at the form's label size, stay on one line and sit on a shared baseline.
- The quantity, unit price and amount columns are wider, and the header and rows share one column definition.
- The table layout switches on the card's width (a container query) rather than the window's, so it falls back to stacked fields whenever the card is too narrow, whether or not the sidebar is open.
