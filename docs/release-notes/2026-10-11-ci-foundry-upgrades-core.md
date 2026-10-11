---
date: 2026-10-11
feature: The CI foundry job installs the OpenZeppelin upgrade validator instead of downloading it inside each test
scope: fix
scenario-impact: none
---

# CI foundry job installs the upgrade validator

The foundry job on `main` at `0efff34` failed
(`PermissionGapsUpgradeTest.test_agentRegistryUpgradesInPlaceAndKeepsStorage`), and
`quality` failed with it. The same code passed on its pull request.

## Cause

- The upgrade-safety tests call `npx @openzeppelin/upgrades-core@^1.37.0 validate`
  through `ffi`.
- The foundry job never installed Node dependencies, so each such test downloaded the
  validator first ("The following package was not found and will be installed").
- Tests run in parallel, so several downloads raced on the same npx cache. One `node`
  process exited with a segmentation fault (139) after the validator had printed
  `SUCCESS`, and the test failed.
- Locally the validator is already in `packages/contracts/node_modules`, so `npx` runs
  it without a download and the race never happens.

## What changed

The foundry job sets up pnpm and Node and runs
`pnpm install --frozen-lockfile --filter @strimz/contracts` before `forge test`. The
version comes from the lockfile (`@openzeppelin/upgrades-core` 1.46.0), as it does
locally.

## Verification

- With an empty npx cache, `npx @openzeppelin/upgrades-core@^1.37.0` in
  `packages/contracts` runs the local copy and prints no download notice. With
  `packages/contracts/node_modules` removed it downloads first, as CI did.
- `./scripts/preflight.sh` in full.
- On the pull request: the foundry job's log shows no "will be installed" line.
