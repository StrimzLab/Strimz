---
date: 2026-11-28
feature: Fanline moves to its own public repository
scope: chore
scenario-impact: none
---

# Fanline moves to its own public repository

Step 7 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md), with the founder's 2026-11-28 amendment.

## What changed

- **Fanline now lives at [github.com/StrimzLab/fanline](https://github.com/StrimzLab/fanline)** under the MIT licence, so anyone can read and copy a full Strimz integration. It uses the published `@strimz/sdk` and `@strimz/sdk-react` from npm.
- **It runs in test mode on Arc testnet:**
  - tips of 1, 2 or 5 USDC, and Pro at 5 USDC a month. The founder lifted the original 1 USDC cap, since every payment is test USDC;
  - the server refuses any other amount, and any creator outside the four demo ones;
  - each visitor is limited to 10 requests a minute per route (Cloudflare rate limiting);
  - the copy says it's a demo, the creators are fictional, and payments use free test USDC.
- **Removed from this repository:**
  - `apps/demo-merchant` and its test (`fanline-demo.test.ts`);
  - its entries in the Worker tests (asset caching, keep-names, SEO hosts), the form-label test, and the `worker-size.sh` and `worker-smoke.sh` scripts;
  - its README line, the engineering-standards tree entry and the `.vercelignore` comment.
- **Links back:**
  - the README and the docs' test mode page point to the Fanline repo and its live demo at `fanline.strimz.finance`;
  - the ADR records the move.

## Not changed

The "Fanline" business name in email-template previews and scheduler tests is sample data and stays.
