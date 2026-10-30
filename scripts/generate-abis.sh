#!/usr/bin/env bash
# Writes the indexer's embedded ABI files from the Foundry build.
# --check compares instead of writing, for CI and preflight.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/packages/contracts/out"
DEST="$ROOT/apps/indexer/internal/abi"
# Events the deployed testnet contracts still emit but the source has dropped.
# Delete this folder at the #142 redeploy.
DEPLOYED_ONLY="$DEST/deployed-only"
CONTRACTS=(StrimzRegistry StrimzPayments StrimzSubscriptions StrimzAgentEscrow FeeCollector TokenWhitelist StrimzAgentRegistry TimelockController IERC20)

check=false
case "${1:-}" in
  "") ;;
  --check) check=true ;;
  *) echo "usage: $0 [--check]" >&2; exit 2 ;;
esac

if [ ! -d "$OUT" ]; then
  echo "missing $OUT: run arc-forge build in packages/contracts first" >&2
  exit 1
fi

target="$DEST"
if $check; then
  target="$(mktemp -d)"
  trap 'rm -rf "$target"' EXIT
fi

for c in "${CONTRACTS[@]}"; do
  src="$OUT/$c.sol/$c.json"
  [ -f "$src" ] || { echo "missing $src" >&2; exit 1; }
  extra="$DEPLOYED_ONLY/$c.events.json"
  if [ -f "$extra" ]; then
    jq --indent 2 --slurpfile extra "$extra" '[.abi[] | select(.type == "event")] + $extra[0]' "$src" > "$target/$c.abi.json"
  else
    jq --indent 2 '[.abi[] | select(.type == "event")]' "$src" > "$target/$c.abi.json"
  fi
done

if $check; then
  drift=false
  for c in "${CONTRACTS[@]}"; do
    if ! diff -u "$DEST/$c.abi.json" "$target/$c.abi.json" > "$target/$c.diff"; then
      drift=true
      cat "$target/$c.diff"
    fi
  done
  if $drift; then
    echo "The indexer ABI files don't match the contract build. Run scripts/generate-abis.sh and commit the result." >&2
    exit 1
  fi
  echo "indexer ABI files match the contract build"
fi
