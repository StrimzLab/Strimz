---
date: 2026-11-13
feature: Plain signing keys allowed in production on Arc testnet only
scope: fix
scenario-impact: none
---

# Testnet signing without AWS KMS

The AWS account that held the relayer and scheduler KMS keys is suspended, and both services refused a plain key in production. See `docs/adr/ADR-2026-11-13-testnet-software-signer.md`.

- With `NODE_ENV=production` and `ARC_ENVIRONMENT=testnet`, the API relayer (`KMS_PROVIDER=software`) and the scheduler (`SCHEDULER_SIGNER_PROVIDER=software`) now start with an explicit key, and each logs a warning at boot.
- On mainnet both still refuse to start. Choosing a mainnet signer is #455.
- Production never generates a key: an empty `KMS_SOFTWARE_PRIVATE_KEY` is refused there, on testnet too.
- `infra/lightsail/env.example` now defaults to the testnet setup, and the KMS runbook explains when it applies.
