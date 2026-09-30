---
date: 2026-09-30
feature: Preflight passes on repeated runs
scope: fix
scenario-impact: none
---

# Preflight builds the contracts before testing them

Nothing user-facing changed. `./scripts/preflight.sh` now passes when run twice on the
same tree, and the pre-push hook passes after a full preflight.

Closes #158.

## What was wrong

`forge test` compiles the sources and tests. The sized build in the last gate compiles
the scripts as well, which writes a second build-info file. The next `forge test` saw
the same contract in both files and the upgrade-safety test failed with "Found multiple
contracts". Only `forge clean` cleared it.

## What shipped

The test gate runs `forge build` before `forge test`, the order CI uses. The full build
happens once, and every later `forge test` or `forge build --sizes` finds nothing to
compile. Measured on a clean tree: two full runs and one `--fast` run in a row all pass.
