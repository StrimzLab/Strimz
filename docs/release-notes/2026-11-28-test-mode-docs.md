---
date: 2026-11-28
feature: Docs explain test mode, the faucet and going live
scope: docs
scenario-impact: none
---

# Docs explain test mode, the faucet and going live

Step 6 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#573).

## What changed

- **"Testing your integration" is now "Test mode and live mode"** (`/docs/testing`, same URL). It covers:
  - the two modes side by side (network, money, keys, API and checkout hosts);
  - that they never share data, and that one sign-up covers both;
  - **how to get test USDC from Circle's faucet** (faucet.circle.com, Arc Testnet, USDC or EURC);
  - building with test keys, with the SDK choosing the host from the key;
  - what's different in test mode: "[Test]" emails, fewer passkey prompts, no real money;
  - a going-live checklist.
- **Every page that said "live mode only" is updated:** the docs home, Quickstart, Getting started, Authentication, the API overview and reference, Errors (`mode_unavailable`), the Glossary (a new "Test mode" entry), API keys, SDKs, the refunds guide and server sessions.
- **The Quickstart now runs in test mode,** with a test key, the test API and faucet USDC. It ends by pointing at going live.
- **Example keys** in the docs are `sk_test_…` first.
- **The API keys page** lists the dashboard's real columns.
- **Dashboard:** the "Get paid" steps on Home follow the switch. In Test they point at faucet USDC and test keys; Live keeps "pay a small amount such as 1 USDC".
