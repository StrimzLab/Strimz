---
date: 2026-11-28
feature: Public read-only mirrors of the SDKs, contracts, site and docs
scope: feat
scenario-impact: none
---

# Public read-only mirrors

[ADR-2026-11-28-public-mirrors](../adr/ADR-2026-11-28-public-mirrors.md), approved by the founder.

## What changed

- **Three public mirrors,** synced on every merge to `main` that touches them, by `.github/workflows/mirror.yml`:
  - `StrimzLab/strimz-sdk`: `packages/sdk`, `sdk-react`, `shared-config`, `shared-crypto`, `shared-types` (MIT);
  - `StrimzLab/strimz-contracts`: `packages/contracts` at the repo root, without its submodules (MIT);
  - `StrimzLab/strimz-web`: `apps/web` and `apps/docs` (all rights reserved).
- **`scripts/mirror-sync.sh`:**
  - builds each copy from git-tracked files only, adds its README, licence and PR template, and runs the guard;
  - then pushes with that mirror's own deploy key, to GitHub's pinned host key;
  - `--dry-run` pushes nothing. Preflight and CI's checks job run it.
- **The guard (`packages/mirror`, with tests) fails closed on:**
  - environment and key files, the mainnet deployment file, and build or run output;
  - full-length API keys, webhook secrets and private keys;
  - any address or keyed 32-byte value not in `mirrors/address-allowlist.txt`. The first list was built from the mirrored folders and checked against the private manual: it holds only testnet contracts, token and bridge contracts, and well-known library and test values.
- **Fixtures and placeholders that looked like real secrets** were made clearly fake: two `shared-crypto` tests, and the `signingSecret` example in the docs.
- **Links:**
  - the five published packages' `homepage` and `repository` point at `strimz-sdk`, and `bugs` at support@strimz.finance (patch changeset);
  - their READMEs and the contracts README no longer link to the private repo;
  - `apps/web/package.json` is `UNLICENSED`, to match its mirror.
- **README:** lists the mirrors and how to allow a new public value.
