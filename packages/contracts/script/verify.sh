#!/usr/bin/env bash
# Strimz contract verification on Arcscan (Blockscout v2 under the hood).
#
# Why curl instead of `forge verify-contract`:
# `forge verify-contract` always performs a chain-name → URL lookup before
# consulting --verifier-url. For Arc Testnet (chain id 5042002) the lookup
# fails: --chain only accepts forge's hardcoded enum, and --chain-id errors
# with "No known Etherscan API URL for chain 5042002". The foundry.toml
# [etherscan] entry isn't reachable for arbitrary chain names either.
#
# Instead, POST directly to Blockscout's documented v2 endpoint:
#   POST /api/v2/smart-contracts/<addr>/verification/via/standard-input
# `forge inspect <Contract> standardJson` produces a minimal per-contract
# standard JSON solc input (~70 KB), small enough for the endpoint to
# accept — unlike the multi-MB whole-project build-info dump.
#
# Usage:
#   cd packages/contracts
#   set -a && source .env && set +a
#   ./script/verify.sh                 # verify everything in the deployment log
#   ./script/verify.sh core            # verify only the "core" label
#   ./script/verify.sh agent           # verify only the "agent" label
#   MAINNET=1 ./script/verify.sh       # use mainnet RPC + verifier
#
# Required env:
#   BLOCKSCOUT_API_KEY          API key from https://testnet.arcscan.app/account/api-keys
#   ARC_TESTNET_RPC_URL         RPC (used only to discover chain id)
#   ARC_TESTNET_VERIFIER_URL    https://testnet.arcscan.app/api/

set -euo pipefail

if [ "${MAINNET:-0}" = "1" ]; then
    RPC=${ARC_MAINNET_RPC_URL:?ARC_MAINNET_RPC_URL not set}
    VERIFIER=${ARC_MAINNET_VERIFIER_URL:?ARC_MAINNET_VERIFIER_URL not set}
    EXPLORER=https://arcscan.app
else
    RPC=${ARC_TESTNET_RPC_URL:?ARC_TESTNET_RPC_URL not set}
    VERIFIER=${ARC_TESTNET_VERIFIER_URL:?ARC_TESTNET_VERIFIER_URL not set}
    EXPLORER=https://testnet.arcscan.app
fi
API_KEY=${BLOCKSCOUT_API_KEY:?BLOCKSCOUT_API_KEY not set in .env}

# Trim trailing slashes; path joins are explicit below.
VERIFIER=${VERIFIER%/}
API_BASE=${VERIFIER%/api}   # https://testnet.arcscan.app

CHAIN_ID=${CHAIN_ID:-$(cast chain-id --rpc-url "$RPC")}
LOG="deployments/${CHAIN_ID}.json"
LABEL_FILTER=${1:-}

[ -f "$LOG" ] || { echo "No deployment log at $LOG" >&2; exit 1; }

# Pinned solc tag — matches `forge build`'s compiler. Update when solc_version
# in foundry.toml moves. Blockscout's verifier requires the long form
# `v<x.y.z>+commit.<hash>`.
COMPILER_VERSION="v0.8.28+commit.7893614a"

# Strimz contract name → fully-qualified Foundry path (src/.../File.sol:Contract).
contract_path() {
    case "$1" in
        StrimzRegistry)      echo "src/core/StrimzRegistry.sol:StrimzRegistry" ;;
        TokenWhitelist)      echo "src/tokens/TokenWhitelist.sol:TokenWhitelist" ;;
        FeeCollector)        echo "src/fees/FeeCollector.sol:FeeCollector" ;;
        StrimzPayments)      echo "src/core/StrimzPayments.sol:StrimzPayments" ;;
        StrimzSubscriptions) echo "src/core/StrimzSubscriptions.sol:StrimzSubscriptions" ;;
        StrimzAgentRegistry) echo "src/agent/StrimzAgentRegistry.sol:StrimzAgentRegistry" ;;
        StrimzAgentEscrow)   echo "src/agent/StrimzAgentEscrow.sol:StrimzAgentEscrow" ;;
        *) return 1 ;;
    esac
}

verify_one() {
    local name=$1 addr=$2 fq tmp_input http_status body
    fq=$(contract_path "$name") || { echo "  skip $name (unknown)"; return 0; }
    echo "  → $name @ $addr"

    # Generate the minimal standard JSON input for just this contract.
    tmp_input=$(mktemp -t strimz-verify.XXXXXX.json)
    if ! forge inspect "$fq" standardJson > "$tmp_input" 2>/dev/null; then
        echo "  FAIL: forge inspect $fq standardJson"
        rm -f "$tmp_input"
        return 1
    fi

    # POST to Blockscout v2 as multipart form-data with the JSON input as
    # `files[0]`. `autodetect_constructor_args` lets Blockscout pull the
    # constructor args from the deployment tx instead of expecting them
    # abi-encoded in the body.
    body=$(curl -sS -w '\n__HTTP__%{http_code}' \
        -X POST "${API_BASE}/api/v2/smart-contracts/${addr}/verification/via/standard-input" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "compiler_version=${COMPILER_VERSION}" \
        -F "license_type=mit" \
        -F "contract_name=${fq}" \
        -F "is_optimization_enabled=true" \
        -F "optimization_runs=1000000" \
        -F "evm_version=cancun" \
        -F "autodetect_constructor_args=true" \
        -F "files[0]=@${tmp_input};type=application/json")
    rm -f "$tmp_input"

    http_status=$(printf '%s' "$body" | awk -F '__HTTP__' '/__HTTP__/ {print $2}')
    body=$(printf '%s' "$body" | sed '/^__HTTP__/d')

    case "$http_status" in
        20[0-9])
            echo "  ok submitted (HTTP $http_status). Verification runs async; check ${EXPLORER}/address/${addr}"
            ;;
        409)
            # Already verified or pending. Treat as success.
            echo "  ok already verified / pending (HTTP 409): $body"
            ;;
        *)
            echo "  FAIL HTTP $http_status:"
            printf '  %s\n' "$body"
            return 1
            ;;
    esac
}

echo "Chain $CHAIN_ID — verifier ${API_BASE}/api/v2 — compiler $COMPILER_VERSION"
echo

# jq builds an "<label>\t<name>\t<impl>\t<proxy>" line per contract; for each
# label, keep only the latest entry so re-deploys win.
jq -r --arg lf "$LABEL_FILTER" '
  ([.[] | select($lf == "" or .label == $lf)]
   | group_by(.label)
   | map(max_by(.timestamp)))
  | .[]
  | . as $d
  | .contracts[]
  | [$d.label, .name, .implementation, .proxy] | @tsv
' "$LOG" | while IFS=$'\t' read -r label name impl proxy; do
    echo "[$label] $name"
    if ! verify_one "$name" "$impl"; then
        echo "  (continuing with next contract)"
    fi
    if [ "$impl" != "$proxy" ]; then
        echo "  proxy $proxy will auto-render once impl is indexed."
    fi
    echo
done

echo "Done. View on $EXPLORER"
