---
date: 2026-11-27
feature: Test deployment runbook and test checkout Worker
scope: ops
scenario-impact: none
---

# Test deployment runbook and test checkout Worker

Step 2 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#565).

## What changed

- **`docs/runbooks/testnet-deployment.md`** (new) covers running the test backend, `strimz-testnet`, beside live on the same server:
  - swap that survives a reboot;
  - the testnet contracts;
  - the env file, which reuses live's Privy app so one login works on both;
  - the container, capped at 768 MB;
  - the Caddy host `api-test.strimz.finance`;
  - releasing to both backends, live first;
  - relayer top-ups.
- **`docs/runbooks/live-deployment.md`** lists both deployments. The stale "Until mainnet" section and the small-real-payment testing advice are gone.
- **`apps/checkout/wrangler.jsonc`** gains a `test` environment that deploys as `strimz-checkout-test`, with its own self-reference binding. The new script `deploy:cloudflare:test` deploys it.

## Not changed

- The live checkout Worker. `strimz-checkout` deploys exactly as before.
- No app code. The passkey changes, SDK host and email labels come in step 3.
