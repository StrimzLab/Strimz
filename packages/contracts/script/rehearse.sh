#!/usr/bin/env bash
set -euo pipefail

CAST="${CAST:-arc-cast}"
FORGE="${FORGE:-arc-forge}"
ANVIL="${ANVIL:-arc-anvil}"
export CAST FORGE

FORK_URL="${ARC_TESTNET_RPC_URL:?ARC_TESTNET_RPC_URL must point at Arc testnet}"
PORT="${REHEARSAL_PORT:-18555}"
LOCAL="http://127.0.0.1:${PORT}"
CHAIN_ID=31337
MNEMONIC="test test test test test test test test test test test junk"
TIMELOCK_DELAY=300
SAFE_PROXY_FACTORY=0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
SAFE_SINGLETON=0x41675C099F32341bf84BFc5382aF534df5C7461a
SAFE_FALLBACK_HANDLER=0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
LOG="deployments/${CHAIN_ID}.json"

cd "$(dirname "$0")/.."

key() { "$CAST" wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index "$1"; }
addr() { "$CAST" wallet address --private-key "$1"; }
step() { printf '\n=== %s ===\n' "$*"; }

[ "$("$CAST" chain-id --rpc-url "$FORK_URL")" = "5042002" ] || { echo "ARC_TESTNET_RPC_URL is not Arc testnet" >&2; exit 1; }

DEPLOYER_KEY=$(key 0)
MERCHANT_KEY=$(key 2)
PAYER_KEY=$(key 3)
RELAYER=$(addr "$(key 4)")
SCHEDULER=$(addr "$(key 5)")
SAFE_OWNER_A=$(addr "$(key 6)")
SAFE_OWNER_B=$(addr "$(key 7)")
SAFE_OWNER_C=$(addr "$(key 8)")
PAYOUT=$(addr "$(key 9)")
DEPLOYER=$(addr "$DEPLOYER_KEY")

step "Fork Arc testnet on ${LOCAL} (chain id ${CHAIN_ID})"
"$ANVIL" --network arc --fork-url "$FORK_URL" --chain-id "$CHAIN_ID" --port "$PORT" > /tmp/strimz-rehearsal-anvil.log 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  "$CAST" block-number --rpc-url "$LOCAL" > /dev/null 2>&1 && break
  sleep 1
done
"$CAST" block-number --rpc-url "$LOCAL" > /dev/null

rm -f "$LOG"
export STRIMZ_DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY"
export ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
export ARC_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a

step "Build from clean"
"$FORGE" clean
"$FORGE" build > /dev/null

step "Deploy core"
"$FORGE" script script/DeployCore.s.sol --network arc --rpc-url "$LOCAL" --broadcast > /dev/null
core() { jq -r --arg n "$1" '[.[] | select(.label == "core")][-1].contracts[] | select(.name == $n) | .proxy' "$LOG"; }
export STRIMZ_REGISTRY_ADDRESS=$(core StrimzRegistry)
export STRIMZ_TOKEN_WHITELIST_ADDRESS=$(core TokenWhitelist)
export STRIMZ_FEE_COLLECTOR_ADDRESS=$(core FeeCollector)
export STRIMZ_PAYMENTS_ADDRESS=$(core StrimzPayments)
export STRIMZ_SUBSCRIPTIONS_ADDRESS=$(core StrimzSubscriptions)
RECORDED_DEPLOYER=$(jq -r '[.[] | select(.label == "core")][-1].deployer' "$LOG")
[ "$(printf '%s' "$RECORDED_DEPLOYER" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$DEPLOYER" | tr '[:upper:]' '[:lower:]')" ] \
  || { echo "deployment log recorded deployer $RECORDED_DEPLOYER, expected $DEPLOYER" >&2; exit 1; }

step "Deploy agent"
"$FORGE" script script/DeployAgent.s.sol --network arc --rpc-url "$LOCAL" --broadcast > /dev/null
agent() { jq -r --arg n "$1" '[.[] | select(.label == "agent")][-1].contracts[] | select(.name == $n) | .proxy' "$LOG"; }
export STRIMZ_AGENT_REGISTRY_ADDRESS=$(agent StrimzAgentRegistry)
export STRIMZ_AGENT_ESCROW_ADDRESS=$(agent StrimzAgentEscrow)

step "Verify (deployed)"
STRIMZ_VERIFY_PHASE=deployed STRIMZ_ADMIN_ADDRESS="$DEPLOYER" \
  "$FORGE" script script/Verify.s.sol --network arc --rpc-url "$LOCAL"

step "End-to-end flows"
STRIMZ_MERCHANT_PRIVATE_KEY="$MERCHANT_KEY" \
STRIMZ_PAYER_PRIVATE_KEY="$PAYER_KEY" \
STRIMZ_MERCHANT_PAYOUT_ADDRESS="$PAYOUT" \
ARC_TESTNET_RPC_URL="$LOCAL" \
  ./script/e2e.sh

step "Create a 2-of-3 Safe on the fork"
INITIALIZER=$("$CAST" calldata \
  "setup(address[],uint256,address,bytes,address,address,uint256,address)" \
  "[$SAFE_OWNER_A,$SAFE_OWNER_B,$SAFE_OWNER_C]" 2 0x0000000000000000000000000000000000000000 0x \
  "$SAFE_FALLBACK_HANDLER" 0x0000000000000000000000000000000000000000 0 0x0000000000000000000000000000000000000000)
SALT=$(date +%s)
SAFE=$("$CAST" call "$SAFE_PROXY_FACTORY" "createProxyWithNonce(address,bytes,uint256)(address)" \
  "$SAFE_SINGLETON" "$INITIALIZER" "$SALT" --from "$DEPLOYER" --rpc-url "$LOCAL")
"$CAST" send "$SAFE_PROXY_FACTORY" "createProxyWithNonce(address,bytes,uint256)" \
  "$SAFE_SINGLETON" "$INITIALIZER" "$SALT" --private-key "$DEPLOYER_KEY" --rpc-url "$LOCAL" > /dev/null
[ "$("$CAST" call "$SAFE" "getThreshold()(uint256)" --rpc-url "$LOCAL")" = "2" ]
echo "Safe: $SAFE"

step "Hand off admin"
export STRIMZ_SAFE_ADDRESS="$SAFE"
export STRIMZ_RELAYER_ADDRESS="$RELAYER"
export STRIMZ_SCHEDULER_ADDRESS="$SCHEDULER"
export TIMELOCK_MIN_DELAY="$TIMELOCK_DELAY"
"$FORGE" script script/HandoffAdmin.s.sol --network arc --rpc-url "$LOCAL" --broadcast > /dev/null
TIMELOCK=$(jq -r '[.[] | select(.label == "handoff")][-1].contracts[0].proxy' "$LOG")

step "Verify (handed-off)"
STRIMZ_VERIFY_PHASE=handed-off STRIMZ_TIMELOCK_ADDRESS="$TIMELOCK" STRIMZ_DEPLOYER_ADDRESS="$DEPLOYER" \
  "$FORGE" script script/Verify.s.sol --network arc --rpc-url "$LOCAL"

step "Rehearsal passed"
echo "Registry:      $STRIMZ_REGISTRY_ADDRESS"
echo "Payments:      $STRIMZ_PAYMENTS_ADDRESS"
echo "Subscriptions: $STRIMZ_SUBSCRIPTIONS_ADDRESS"
echo "Timelock:      $TIMELOCK"
echo "Safe:          $SAFE"
echo "Log:           $LOG (not committed)"
