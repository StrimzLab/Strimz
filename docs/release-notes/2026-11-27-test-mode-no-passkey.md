---
date: 2026-11-27
feature: No Strimz passkey prompts in test mode
scope: feat
scenario-impact: none
---

# No Strimz passkey prompts in test mode

Step 4 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#574), second part.

## What changed

With the dashboard switch on **Test**, Strimz no longer asks for a passkey to:

- create or rotate an API key;
- create a webhook endpoint or rotate its secret;
- open Withdraw, or change the payout wallet or owner in Settings;
- sign a refund.

Live mode asks exactly as before. The passkey step at sign-up is unchanged.

## Still asks in test mode

Privy, the wallet provider, asks for the passkey before any signature from the embedded wallet, on any network. Test withdrawals and refunds therefore still show Privy's prompt, at most once every 15 minutes (founder, 2026-11-27).

## How

- `asksStrimzPasskey(mode)` (`apps/dashboard/src/lib/passkey-policy.ts`) is true for live only.
- `useStepUp`, `PasskeyGate` and the refund signer all consult it.
- In test mode no step-up token is sent. The test backend already skips the check (#570).

## Runbook fix

`docs/runbooks/testnet-deployment.md` now grants the relayer and scheduler their operating roles when the testnet deploy skips the admin handoff. The handoff was what granted them, so without it the first test account's on-chain registration reverted. The four roles were granted on the testnet contracts on 2026-11-27.
