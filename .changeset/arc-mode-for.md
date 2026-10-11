---
'@strimz/shared-config': minor
---

New `arcModeFor(env)`: maps an Arc environment to the mode a deployment on it runs in (`testnet` → `test`, `mainnet` → `live`). Throws on an unknown environment.
