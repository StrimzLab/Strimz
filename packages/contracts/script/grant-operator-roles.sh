#!/usr/bin/env bash
# Strimz post-deploy role-grant runbook.
#
# `DeployCore.s.sol` initialises every role on the deployer EOA (the
# `admin` constructor arg). That key is meant to be cold; the hot keys
# that run the services need their own grants:
#
#   apps/api    relayer signer — calls Registry.registerMerchant
#               needs MERCHANT_REGISTRAR_ROLE on StrimzRegistry
#
#   apps/scheduler signer — calls Subscriptions.batchCharge
#               needs CHARGER_ROLE on StrimzSubscriptions
#
# The script is idempotent: it `cast call`s `hasRole` before every
# `cast send`, so a re-run after rotating an operator key only sends
# the grants that are genuinely missing.
#
# Why bash, not a forge script: forge's chain registry rejects Arc's
# chain id (5042002) under `--broadcast`. cast send goes straight to
# the RPC — same pattern as script/verify.sh and script/e2e.sh.
#
# Usage:
#   cd packages/contracts
#   set -a && source .env && set +a
#   ./script/grant-operator-roles.sh
#
# Required env:
#   STRIMZ_DEPLOYER_PRIVATE_KEY     admin EOA with DEFAULT_ADMIN_ROLE
#   STRIMZ_REGISTRY_ADDRESS         Registry proxy
#   STRIMZ_SUBSCRIPTIONS_ADDRESS    Subscriptions (immutable)
#   STRIMZ_RELAYER_ADDRESS          apps/api KMS-signer EOA
#   STRIMZ_SCHEDULER_ADDRESS        apps/scheduler signer EOA
#   ARC_TESTNET_RPC_URL             (or ARC_MAINNET_RPC_URL with MAINNET=1)

set -euo pipefail

if [ "${MAINNET:-0}" = "1" ]; then
    RPC=${ARC_MAINNET_RPC_URL:?ARC_MAINNET_RPC_URL not set}
    NETWORK=mainnet
else
    RPC=${ARC_TESTNET_RPC_URL:?ARC_TESTNET_RPC_URL not set}
    NETWORK=testnet
fi

required_env=(
    STRIMZ_DEPLOYER_PRIVATE_KEY
    STRIMZ_REGISTRY_ADDRESS
    STRIMZ_SUBSCRIPTIONS_ADDRESS
    STRIMZ_RELAYER_ADDRESS
    STRIMZ_SCHEDULER_ADDRESS
)
for v in "${required_env[@]}"; do
    if [ -z "${!v:-}" ]; then
        echo "ERROR: $v not set. Run 'set -a && source .env && set +a' first." >&2
        exit 1
    fi
done

MERCHANT_REGISTRAR_ROLE=$(cast keccak "STRIMZ_MERCHANT_REGISTRAR_ROLE")
CHARGER_ROLE=$(cast keccak "STRIMZ_CHARGER_ROLE")

printf '\n=== Strimz operator role grants (%s) ===\n' "$NETWORK"
printf '  Registry:      %s\n' "$STRIMZ_REGISTRY_ADDRESS"
printf '  Subscriptions: %s\n' "$STRIMZ_SUBSCRIPTIONS_ADDRESS"
printf '  Relayer:       %s\n' "$STRIMZ_RELAYER_ADDRESS"
printf '  Scheduler:     %s\n\n' "$STRIMZ_SCHEDULER_ADDRESS"

grant_if_missing() {
    local target=$1 role=$2 role_label=$3 account=$4

    local already
    already=$(cast call "$target" "hasRole(bytes32,address)(bool)" "$role" "$account" --rpc-url "$RPC")
    if [ "$already" = "true" ]; then
        printf '  skip  %s on %s — already held by %s\n' "$role_label" "$target" "$account"
        return 0
    fi

    printf '  grant %s on %s -> %s\n' "$role_label" "$target" "$account"
    cast send "$target" \
        "grantRole(bytes32,address)" "$role" "$account" \
        --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY" \
        --rpc-url "$RPC" \
        --json > /dev/null
    printf '        ok\n'
}

grant_if_missing \
    "$STRIMZ_REGISTRY_ADDRESS" \
    "$MERCHANT_REGISTRAR_ROLE" "MERCHANT_REGISTRAR_ROLE" \
    "$STRIMZ_RELAYER_ADDRESS"

grant_if_missing \
    "$STRIMZ_SUBSCRIPTIONS_ADDRESS" \
    "$CHARGER_ROLE" "CHARGER_ROLE" \
    "$STRIMZ_SCHEDULER_ADDRESS"

echo
echo 'done.'
