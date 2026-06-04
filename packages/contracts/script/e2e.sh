#!/usr/bin/env bash
# Strimz on-chain end-to-end smoke test (Arc Testnet by default).
#
# Drives the deployed contracts through the same five flows the hosted
# checkout produces:
#   1. Strimz registers a fresh merchant
#   2. Payer pays via classic pay()
#   3. Payer signs EIP-3009; admin (relayer) broadcasts payWithAuthorization
#   4. Payer signs EIP-2612 permit; admin broadcasts permitAndCreateSubscription
#   5. Merchant cancels the subscription from their own wallet
#
# Everything broadcasts via `cast send`; everything verifies via `cast call`.
# No `forge script --broadcast`, no local EVM simulation.
#
# Why not forge script: Foundry's local EVM doesn't implement Arc's protocol
# precompiles (Native Coin Authority at 0x1800..0000 and Blocklist at
# 0x1800..0001). USDC's transferFrom invokes both, so the local sim reverts
# before any tx can be built. cast send goes straight to the RPC, where the
# precompiles are installed.
#
# Signing happens in script/Digests.s.sol via `vm.sign` — it reads the
# payer key from STRIMZ_PAYER_PRIVATE_KEY at runtime, builds the EIP-712
# digest from live USDC state, signs locally, and prints (v, r, s) markers
# this script greps out and feeds to `cast send`.
#
# Usage:
#   cd packages/contracts
#   set -a && source .env && set +a
#   ./script/e2e.sh
#
# Required env (already loaded if .env contains them):
#   STRIMZ_DEPLOYER_PRIVATE_KEY       Strimz; holds MERCHANT_REGISTRAR_ROLE
#   STRIMZ_MERCHANT_PRIVATE_KEY       The merchant; cancels in stage 5
#   STRIMZ_PAYER_PRIVATE_KEY          The payer; signs EIP-712 messages
#   STRIMZ_MERCHANT_PAYOUT_ADDRESS    Where the merchant receives funds
#   STRIMZ_REGISTRY_ADDRESS           Live Registry proxy
#   STRIMZ_TOKEN_WHITELIST_ADDRESS    Live TokenWhitelist proxy
#   STRIMZ_FEE_COLLECTOR_ADDRESS      Live FeeCollector proxy
#   STRIMZ_PAYMENTS_ADDRESS           Live StrimzPayments (immutable)
#   STRIMZ_SUBSCRIPTIONS_ADDRESS      Live StrimzSubscriptions (immutable)
#   ARC_USDC_ADDRESS                  USDC (0x3600...0000 on Arc testnet)
#   ARC_TESTNET_RPC_URL               RPC endpoint

set -euo pipefail

# ----- env validation -----
required_env=(
    STRIMZ_DEPLOYER_PRIVATE_KEY STRIMZ_MERCHANT_PRIVATE_KEY STRIMZ_PAYER_PRIVATE_KEY
    STRIMZ_MERCHANT_PAYOUT_ADDRESS
    STRIMZ_REGISTRY_ADDRESS STRIMZ_TOKEN_WHITELIST_ADDRESS STRIMZ_FEE_COLLECTOR_ADDRESS
    STRIMZ_PAYMENTS_ADDRESS STRIMZ_SUBSCRIPTIONS_ADDRESS
    ARC_USDC_ADDRESS ARC_TESTNET_RPC_URL
)
for v in "${required_env[@]}"; do
    if [ -z "${!v:-}" ]; then
        echo "ERROR: $v not set. Run 'set -a && source .env && set +a' first." >&2
        exit 1
    fi
done

RPC="$ARC_TESTNET_RPC_URL"
ADMIN=$(cast wallet address --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY")
MERCHANT=$(cast wallet address --private-key "$STRIMZ_MERCHANT_PRIVATE_KEY")
PAYER=$(cast wallet address --private-key "$STRIMZ_PAYER_PRIVATE_KEY")

FEE_BPS=200
ONE_USDC=1000000
EXPECTED_FEE=$((ONE_USDC * FEE_BPS / 10000))
EXPECTED_NET=$((ONE_USDC - EXPECTED_FEE))

# ----- helpers -----
hdr() { printf '\n=== %s ===\n' "$*"; }
section() { printf '\n[%s] %s\n' "$1" "$2"; }
ok() { printf '  ok %s\n' "$*"; }
fail() { printf '  FAIL: %s\n' "$*"; exit 1; }

# Bash 3 (default on macOS) has no `${var,,}`, use tr instead.
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

assert_eq() {
    local desc=$1 actual=$2 expected=$3
    if [ "$actual" = "$expected" ]; then ok "$desc = $actual"
    else fail "$desc: got '$actual', want '$expected'"
    fi
}

# Asserts a self-broadcast actor's USDC drop equals `expected_payment` plus a
# bounded gas component (≤ gas_budget). Arc charges gas in USDC, so any tx
# the actor signs themselves debits a small amount on top of the explicit
# transfer. Relayed paths (stages 3 + 4) use plain assert_eq, since the
# payer broadcasts nothing.
GAS_BUDGET=100000  # 0.1 USDC — a single pay() ≈ 0.003 USDC in practice.

assert_drop_with_gas() {
    local desc=$1 actual=$2 expected_payment=$3
    local gas=$((actual - expected_payment))
    if [ "$actual" -lt "$expected_payment" ] || [ "$gas" -gt "$GAS_BUDGET" ]; then
        fail "$desc: got $actual, want $expected_payment + ≤$GAS_BUDGET gas"
    fi
    ok "$desc = $actual ($expected_payment payment + $gas gas)"
}

# cast prints large uints with a trailing scientific annotation like
# "20000000 [2e7]"; strip it so the value flows into bash arithmetic.
strip_uint() { awk '{print $1}'; }

balance() {
    cast call "$ARC_USDC_ADDRESS" "balanceOf(address)(uint256)" "$1" --rpc-url "$RPC" | strip_uint
}

send_as() {
    local key=$1; shift
    cast send "$@" --private-key "$key" --rpc-url "$RPC" --json > /dev/null
}

# Same as send_as, but prints the receipt JSON to stdout so the caller can
# parse logs without a second RPC round-trip.
send_as_capture() {
    local key=$1; shift
    cast send "$@" --private-key "$key" --rpc-url "$RPC" --json
}

# Run script/Digests.s.sol's signing helper for the given signature and args.
# The script computes the EIP-712 digest from live USDC state and signs it
# with the payer's key (read from STRIMZ_PAYER_PRIVATE_KEY) via vm.sign,
# emitting three marker lines: __SIG_V__, __SIG_R__, __SIG_S__.
# Echoes "v r s" so the caller can split it with `read`.
sign_via_forge() {
    local sig=$1; shift
    local output rc
    output=$(forge script script/Digests.s.sol --sig "$sig" "$@" --rpc-url "$RPC" 2>&1) && rc=0 || rc=$?
    if [ "$rc" -ne 0 ]; then
        printf '  forge script failed (exit %s):\n%s\n' "$rc" "$output" >&2
        return 1
    fi
    local v r s
    v=$(printf '%s\n' "$output" | grep -oE '__SIG_V__=[0-9]+'            | sed -n '1{s/^__SIG_V__=//;p;}')
    r=$(printf '%s\n' "$output" | grep -oE '__SIG_R__=0x[0-9a-fA-F]{64}' | sed -n '1{s/^__SIG_R__=//;p;}')
    s=$(printf '%s\n' "$output" | grep -oE '__SIG_S__=0x[0-9a-fA-F]{64}' | sed -n '1{s/^__SIG_S__=//;p;}')
    if [ -z "$v" ] || [ -z "$r" ] || [ -z "$s" ]; then
        printf '  signature markers missing from forge output:\n%s\n' "$output" >&2
        return 1
    fi
    printf '%s %s %s' "$v" "$r" "$s"
}

# Read a specific line of cast's multi-field output (1-indexed) and strip
# any trailing scientific annotation like " [2e7]" that cast tacks onto
# large uints. The first whitespace-separated token is the raw value.
field() { sed -n "${2}p" | awk '{print $1}'; }

# Normalise a cast tuple-return into one value per line. Cast prints tuple
# returns as a parenthesised, comma-separated, sometimes multi-line blob
# with optional "[Ne]" scientific annotations on large uints, e.g.:
#   (0xabc...,
#    1748985600,
#    1000000 [1e6],
#    false)
# This emits each field on its own line, annotation-free, so the existing
# `field` helper can index into it.
parse_tuple() {
    sed 's/\[[^]]*\]//g' | tr -d '()\n ' | tr ',' '\n'
}

# ----- pre-flight -----
hdr "Strimz on-chain end-to-end (Arc Testnet)"
echo "RPC:                $RPC"
echo "Strimz (admin):     $ADMIN"
echo "merchant (owner):   $MERCHANT"
echo "merchant payout:    $STRIMZ_MERCHANT_PAYOUT_ADDRESS"
echo "payer:              $PAYER"

[ "$ADMIN" != "$MERCHANT" ] || fail "admin and merchant must be distinct"
[ "$ADMIN" != "$PAYER" ]    || fail "admin and payer must be distinct"
[ "$MERCHANT" != "$PAYER" ] || fail "merchant and payer must be distinct"

PAYER_BAL_0=$(balance "$PAYER")
PAYOUT_BAL_0=$(balance "$STRIMZ_MERCHANT_PAYOUT_ADDRESS")
FEE_BAL_0=$(balance "$STRIMZ_FEE_COLLECTOR_ADDRESS")

echo
echo "Initial balances (raw, 6 decimals):"
echo "  payer:        $PAYER_BAL_0"
echo "  payout:       $PAYOUT_BAL_0"
echo "  FeeCollector: $FEE_BAL_0"

# Two payment stages cost 2 USDC; budget for gas.
required_payer_balance=$((2 * ONE_USDC + 100000))
if [ "$PAYER_BAL_0" -lt "$required_payer_balance" ]; then
    echo
    fail "payer balance ($PAYER_BAL_0) below 2.1 USDC. Top up at faucet.circle.com (Arc testnet)."
fi

# ----- stage 1: register merchant -----
section 1 "Strimz registers the merchant"

NEXT_ID=$(cast call "$STRIMZ_REGISTRY_ADDRESS" "nextMerchantId()(uint256)" --rpc-url "$RPC" | strip_uint)
MERCHANT_ID="$NEXT_ID"
echo "  expected merchantId: $MERCHANT_ID"

send_as "$STRIMZ_DEPLOYER_PRIVATE_KEY" \
    "$STRIMZ_REGISTRY_ADDRESS" \
    "registerMerchant(address,address,uint16,uint256)" \
    "$MERCHANT" "$STRIMZ_MERCHANT_PAYOUT_ADDRESS" "$FEE_BPS" 0

M=$(cast call "$STRIMZ_REGISTRY_ADDRESS" \
    "getMerchant(uint256)(address,uint16,bool,address,uint256)" "$MERCHANT_ID" \
    --rpc-url "$RPC")
OWNER=$(printf '%s' "$M" | field _ 1)
FEE_STORED=$(printf '%s' "$M" | field _ 2)
ACTIVE=$(printf '%s' "$M" | field _ 3)
PAYOUT=$(printf '%s' "$M" | field _ 4)

assert_eq "owner"     "$(lower "$OWNER")"  "$(lower "$MERCHANT")"
assert_eq "feeBps"    "$FEE_STORED"        "$FEE_BPS"
assert_eq "active"    "$ACTIVE"            "true"
assert_eq "payoutAddress" "$(lower "$PAYOUT")" "$(lower "$STRIMZ_MERCHANT_PAYOUT_ADDRESS")"

# ----- stage 2: classic pay -----
section 2 "Payer pays via classic pay()"

send_as "$STRIMZ_PAYER_PRIVATE_KEY" \
    "$ARC_USDC_ADDRESS" "approve(address,uint256)" "$STRIMZ_PAYMENTS_ADDRESS" "$ONE_USDC"

send_as "$STRIMZ_PAYER_PRIVATE_KEY" \
    "$STRIMZ_PAYMENTS_ADDRESS" \
    "pay(uint256,address,uint256,bytes32)" \
    "$MERCHANT_ID" "$ARC_USDC_ADDRESS" "$ONE_USDC" \
    "0x000000000000000000000000000000000000000000000000000000000000e2e2"

PAYER_BAL_1=$(balance "$PAYER")
PAYOUT_BAL_1=$(balance "$STRIMZ_MERCHANT_PAYOUT_ADDRESS")
FEE_BAL_1=$(balance "$STRIMZ_FEE_COLLECTOR_ADDRESS")

# Payer broadcasts approve + pay here, so the drop includes ~2 txs' worth
# of gas (paid in USDC on Arc). Payout + fee are pure transfers in.
assert_drop_with_gas "payer delta"  "$((PAYER_BAL_0 - PAYER_BAL_1))"   "$ONE_USDC"
assert_eq            "payout delta" "$((PAYOUT_BAL_1 - PAYOUT_BAL_0))" "$EXPECTED_NET"
assert_eq            "fee delta"    "$((FEE_BAL_1 - FEE_BAL_0))"       "$EXPECTED_FEE"

# ----- stage 3: EIP-3009 payWithAuthorization -----
section 3 "Payer signs EIP-3009; relayer broadcasts payWithAuthorization"

NOW=$(cast block latest --field timestamp --rpc-url "$RPC" | strip_uint)
VALID_AFTER=$((NOW - 1))
VALID_BEFORE=$((NOW + 3600))
AUTH_NONCE=$(cast keccak "strimz.e2e.payAuth.$NOW")

echo "  computing + signing EIP-3009 via forge script (can take ~20s)..."
SIG_OUT=$(sign_via_forge \
    "signReceiveWithAuth(address,address,uint256,uint256,uint256,bytes32)" \
    "$PAYER" "$STRIMZ_PAYMENTS_ADDRESS" "$ONE_USDC" "$VALID_AFTER" "$VALID_BEFORE" "$AUTH_NONCE")
read -r V R S <<<"$SIG_OUT"
[ -n "${V:-}" ] || fail "stage 3: failed to obtain receiveWithAuth signature"
echo "  signature ok (v=$V)"

echo "  broadcasting payWithAuthorization as admin..."
send_as "$STRIMZ_DEPLOYER_PRIVATE_KEY" \
    "$STRIMZ_PAYMENTS_ADDRESS" \
    "payWithAuthorization(uint256,address,(address,uint256,uint256,uint256,bytes32),bytes32,uint8,bytes32,bytes32)" \
    "$MERCHANT_ID" "$ARC_USDC_ADDRESS" \
    "($PAYER,$ONE_USDC,$VALID_AFTER,$VALID_BEFORE,$AUTH_NONCE)" \
    "0x000000000000000000000000000000000000000000000000000000000000e2e3" \
    "$V" "$R" "$S"

USED=$(cast call "$ARC_USDC_ADDRESS" "authorizationState(address,bytes32)(bool)" \
    "$PAYER" "$AUTH_NONCE" --rpc-url "$RPC")
assert_eq "nonce used after submit" "$USED" "true"

PAYER_BAL_2=$(balance "$PAYER")
PAYOUT_BAL_2=$(balance "$STRIMZ_MERCHANT_PAYOUT_ADDRESS")
FEE_BAL_2=$(balance "$STRIMZ_FEE_COLLECTOR_ADDRESS")

assert_eq "payer delta"  "$((PAYER_BAL_1 - PAYER_BAL_2))"   "$ONE_USDC"
assert_eq "payout delta" "$((PAYOUT_BAL_2 - PAYOUT_BAL_1))" "$EXPECTED_NET"
assert_eq "fee delta"    "$((FEE_BAL_2 - FEE_BAL_1))"       "$EXPECTED_FEE"

# ----- stage 4: subscription via EIP-2612 permit -----
section 4 "Payer signs EIP-2612 permit; relayer broadcasts permitAndCreateSubscription"

INTERVAL=3600  # MIN_INTERVAL on StrimzSubscriptions is 1 hour.
START_AT=0
END_AT=0
PERMIT_VALUE="115792089237316195423570985008687907853269984665640564039457584007913129639935"  # type(uint256).max
DEADLINE=$((NOW + 3600))

echo "  computing + signing EIP-2612 permit via forge script..."
PERMIT_SIG_OUT=$(sign_via_forge \
    "signPermit(address,address,uint256,uint256)" \
    "$PAYER" "$STRIMZ_SUBSCRIPTIONS_ADDRESS" "$PERMIT_VALUE" "$DEADLINE")
read -r PV PR PS <<<"$PERMIT_SIG_OUT"
[ -n "${PV:-}" ] || fail "stage 4: failed to obtain permit signature"
echo "  signature ok (v=$PV)"
echo "  broadcasting permitAndCreateSubscription as admin..."

RECEIPT=$(send_as_capture "$STRIMZ_DEPLOYER_PRIVATE_KEY" \
    "$STRIMZ_SUBSCRIPTIONS_ADDRESS" \
    "permitAndCreateSubscription(uint256,address,uint256,uint32,uint64,uint64,(address,uint256,uint256),uint8,bytes32,bytes32)" \
    "$MERCHANT_ID" "$ARC_USDC_ADDRESS" "$ONE_USDC" "$INTERVAL" "$START_AT" "$END_AT" \
    "($PAYER,$PERMIT_VALUE,$DEADLINE)" \
    "$PV" "$PR" "$PS")

# SubscriptionCreated(subscriptionId indexed, merchantId indexed, payer indexed, token, amount, interval, endAt).
# topic[0] = signature hash, topic[1] = subscriptionId. Pull it straight out
# of the receipt the previous call already returned.
SUB_SIG=$(cast keccak "SubscriptionCreated(uint256,uint256,address,address,uint256,uint32,uint64)")
SUB_TOPIC1=$(printf '%s' "$RECEIPT" \
    | jq -r --arg sig "$SUB_SIG" \
        '.logs[] | select(.topics[0] == $sig) | .topics[1]' \
    | head -1)
[ -n "$SUB_TOPIC1" ] || fail "stage 4: SubscriptionCreated event missing from receipt"
SUB_ID=$(cast --to-dec "$SUB_TOPIC1")
echo "  subscriptionId: $SUB_ID"

SUB=$(cast call "$STRIMZ_SUBSCRIPTIONS_ADDRESS" \
    "getSubscription(uint256)((address,uint64,uint32,address,uint96,uint256,uint64,bool))" \
    "$SUB_ID" --rpc-url "$RPC" | parse_tuple)
SUB_PAYER=$(printf '%s' "$SUB" | field _ 1)
SUB_INTERVAL=$(printf '%s' "$SUB" | field _ 3)
SUB_TOKEN=$(printf '%s' "$SUB" | field _ 4)
SUB_MERCHANT_ID=$(printf '%s' "$SUB" | field _ 5)
SUB_AMOUNT=$(printf '%s' "$SUB" | field _ 6)
SUB_CANCELLED=$(printf '%s' "$SUB" | field _ 8)

assert_eq "sub payer"      "$(lower "$SUB_PAYER")"  "$(lower "$PAYER")"
assert_eq "sub interval"   "$SUB_INTERVAL"          "$INTERVAL"
assert_eq "sub token"      "$(lower "$SUB_TOKEN")"  "$(lower "$ARC_USDC_ADDRESS")"
assert_eq "sub merchantId" "$SUB_MERCHANT_ID"       "$MERCHANT_ID"
assert_eq "sub amount"     "$SUB_AMOUNT"            "$ONE_USDC"
assert_eq "sub cancelled"  "$SUB_CANCELLED"         "false"

# ----- stage 5: merchant cancels -----
section 5 "Merchant cancels the subscription from their own wallet"

send_as "$STRIMZ_MERCHANT_PRIVATE_KEY" \
    "$STRIMZ_SUBSCRIPTIONS_ADDRESS" \
    "cancel(uint256)" "$SUB_ID"

SUB_AFTER=$(cast call "$STRIMZ_SUBSCRIPTIONS_ADDRESS" \
    "getSubscription(uint256)((address,uint64,uint32,address,uint96,uint256,uint64,bool))" \
    "$SUB_ID" --rpc-url "$RPC" | parse_tuple)
CANCELLED_AFTER=$(printf '%s' "$SUB_AFTER" | field _ 8)
assert_eq "sub cancelled after" "$CANCELLED_AFTER" "true"

# ----- summary -----
hdr "All stages passed"
echo "merchantId:     $MERCHANT_ID"
echo "subscriptionId: $SUB_ID"
echo
echo "Final balances (raw, 6 decimals):"
echo "  payer:        $(balance "$PAYER")"
echo "  payout:       $(balance "$STRIMZ_MERCHANT_PAYOUT_ADDRESS")"
echo "  FeeCollector: $(balance "$STRIMZ_FEE_COLLECTOR_ADDRESS")"
