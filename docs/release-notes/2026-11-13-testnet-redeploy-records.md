---
date: 2026-11-13
feature: Record the 2026-11-09 Arc testnet redeploy
scope: chore
scenario-impact: none
---

# Testnet redeploy records

The contracts were redeployed to Arc testnet on 2026-11-09, starting at block 71161770, and the apps switched to them in #402. This records the new addresses everywhere they're written down.

- `packages/contracts/deployments/5042002.json` gains the `core`, `agent` and `handoff` deployment entries, with each proxy and implementation and the TimelockController.
- The root and contracts READMEs list the new addresses. The contracts README also names the TimelockController (300 s delay) and the 2-of-2 admin Safe, and notes that the agent escrow is paused.
- `infra/lightsail/env.example` and `apps/indexer/.env.example` use the new addresses, including `AGENT_REGISTRY_ADDRESS` and `TIMELOCK_ADDRESS`, and `START_BLOCK=71161770`.
- The explorer links and the verifier comments point at `explorer.testnet.arc.io`.

No code changes. A deployment built from `infra/lightsail/env.example` now starts on the live testnet contracts instead of the old ones.
