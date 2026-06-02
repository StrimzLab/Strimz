// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";

import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

/// @dev Minimal USDC surface used by the e2e flow. The real Arc USDC at
///      `0x3600...0000` implements both EIP-2612 (`Permit`) and EIP-3009
///      (`ReceiveWithAuthorization`) per Circle's reference contract, so
///      both typed-data helpers are available.
interface IUSDC {
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function nonces(address owner) external view returns (uint256);

    /// @dev Casing fixed by USDC's on-chain ABI. The next two getter
    ///      names must match byte-for-byte or the call fails at the
    ///      selector. See packages/contracts/src/interfaces/IERC2612.sol
    ///      for the same constraint on the standardised EIP-2612 surface.
    // forge-lint: disable-next-line(mixed-case-function)
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    // forge-lint: disable-next-line(mixed-case-function)
    function RECEIVE_WITH_AUTHORIZATION_TYPEHASH() external view returns (bytes32);

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}

/// @title E2E
/// @notice Five-stage smoke test against a deployed Strimz suite on a live
///         chain. The script drives the same flows the hosted checkout
///         produces: classic `pay()`, EIP-3009 `payWithAuthorization`,
///         EIP-2612 `permitAndCreateSubscription`, and the manual `cancel`.
///         After each stage it reads balances back and asserts the deltas
///         match the expected fee split (gross = fee + net).
///
///         **What this is not.** It is not exhaustive — the unit and
///         invariant suites cover that. This is the live-network
///         counterpart of those tests: signatures get built and verified
///         against a real token contract, gas gets paid in USDC, role
///         checks run against the actually-deployed Registry. If a signing
///         helper is off by one byte, this script reverts in seconds.
///
///         **Three distinct actors.** This mirrors the production
///         authorization model:
///           - Strimz (admin) holds `MERCHANT_REGISTRAR_ROLE` and calls
///             `registerMerchant` on the merchant's behalf. Acts as the
///             relayer for meta-tx submissions in stages 3 and 4.
///           - The merchant is the business onboarding on Strimz. Their
///             wallet is recorded as the merchant entry's `owner` and is
///             the only address (besides the payer) that can cancel an
///             active subscription.
///           - The payer is the merchant's customer. Signs EIP-3009 and
///             EIP-2612 messages; never broadcasts a transaction.
///
///         The script rejects any run where two of the three resolve to
///         the same address, so signature recovery and role-side asserts
///         cannot accidentally pass for the wrong reason.
///
/// Usage (see contracts/README.md for the full runbook):
///
///   STRIMZ_DEPLOYER_PRIVATE_KEY=0x...
///   STRIMZ_MERCHANT_PRIVATE_KEY=0x...     # the business; needs gas for the cancel
///   STRIMZ_PAYER_PRIVATE_KEY=0x...        # funded with Arc-testnet USDC
///   STRIMZ_MERCHANT_PAYOUT_ADDRESS=0x...  # where the merchant receives funds
///   STRIMZ_REGISTRY_ADDRESS=0x...
///   STRIMZ_TOKEN_WHITELIST_ADDRESS=0x...
///   STRIMZ_FEE_COLLECTOR_ADDRESS=0x...
///   STRIMZ_PAYMENTS_ADDRESS=0x...
///   STRIMZ_SUBSCRIPTIONS_ADDRESS=0x...
///   ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
///   forge script script/E2E.s.sol --rpc-url arc_testnet --broadcast -vvv
contract E2E is Script {
    // ---------- actors ----------
    uint256 private adminKey;
    address private admin;
    uint256 private merchantKey;
    address private merchant;
    uint256 private payerKey;
    address private payer;
    address private merchantPayout;

    // ---------- contracts ----------
    IStrimzRegistry private registry;
    ITokenWhitelist private whitelist;
    IStrimzPayments private payments;
    IStrimzSubscriptions private subs;
    IUSDC private usdc;

    // ---------- run state ----------
    uint256 private merchantId;
    uint16 private constant FEE_BPS = 200; // 2%; used in expected-fee asserts.
    uint256 private constant ONE_USDC = 1_000_000; // 6 decimals on Arc USDC.

    // ---------- EIP-2612 typehash ----------
    bytes32 private constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    function run() external {
        _loadEnv();
        _printHeader();

        merchantId = _stageRegisterMerchant();
        _stagePayClassic();
        _stagePayWithAuthorization();
        uint256 subId = _stageSubscriptionViaPermit();
        _stageCancelSubscription(subId);

        console2.log("");
        console2.log("=== all stages passed ===");
    }

    // ============================================================
    // Stages
    // ============================================================

    function _stageRegisterMerchant() private returns (uint256 mId) {
        console2.log("[1] Strimz (admin) registers the merchant on-chain");
        console2.log("  caller (Strimz)  ", admin);
        console2.log("  owner (merchant) ", merchant);
        console2.log("  payoutAddress    ", merchantPayout);
        console2.log("  feeBps           ", FEE_BPS);

        vm.startBroadcast(adminKey);
        mId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopBroadcast();

        IStrimzRegistry.Merchant memory m = registry.getMerchant(mId);
        require(m.owner == merchant, "stage 1: owner should be the merchant key, not the caller");
        require(m.payoutAddress == merchantPayout, "stage 1: payout mismatch");
        require(m.feeBps == FEE_BPS, "stage 1: feeBps mismatch");
        require(m.active, "stage 1: not active");

        console2.log("  merchantId       ", mId);
        console2.log("[ok] stage 1");
        console2.log("");
    }

    function _stagePayClassic() private {
        console2.log("[2] one-shot payment via classic pay()");
        uint256 gross = ONE_USDC;
        uint256 expectedFee = (gross * FEE_BPS) / 10_000;
        uint256 expectedNet = gross - expectedFee;
        _requirePayerHasAtLeast(gross, "stage 2");

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 payoutBefore = usdc.balanceOf(merchantPayout);
        uint256 feeBefore = usdc.balanceOf(_feeCollectorAddr());

        vm.startBroadcast(payerKey);
        usdc.approve(address(payments), gross);
        payments.pay(merchantId, address(usdc), gross, bytes32(uint256(0xE2E2)));
        vm.stopBroadcast();

        uint256 payerAfter = usdc.balanceOf(payer);
        uint256 payoutAfter = usdc.balanceOf(merchantPayout);
        uint256 feeAfter = usdc.balanceOf(_feeCollectorAddr());

        require(payerBefore - payerAfter == gross, "stage 2: payer delta mismatch");
        require(payoutAfter - payoutBefore == expectedNet, "stage 2: payout delta mismatch");
        require(feeAfter - feeBefore == expectedFee, "stage 2: fee delta mismatch");

        console2.log("  payer       paid", gross);
        console2.log("  merchant got    ", expectedNet);
        console2.log("  fees       took ", expectedFee);
        console2.log("[ok] stage 2");
        console2.log("");
    }

    function _stagePayWithAuthorization() private {
        console2.log("[3] one-shot payment via EIP-3009 payWithAuthorization");
        uint256 gross = ONE_USDC;
        uint256 expectedFee = (gross * FEE_BPS) / 10_000;
        uint256 expectedNet = gross - expectedFee;
        _requirePayerHasAtLeast(gross, "stage 3");

        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: gross,
            validAfter: block.timestamp == 0 ? 0 : block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: keccak256(abi.encodePacked("strimz.e2e.payAuth", block.chainid, block.timestamp))
        });
        require(!usdc.authorizationState(payer, auth.nonce), "stage 3: nonce already used");

        (uint8 v, bytes32 r, bytes32 s) = _signReceiveWithAuthorization(auth);

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 payoutBefore = usdc.balanceOf(merchantPayout);
        uint256 feeBefore = usdc.balanceOf(_feeCollectorAddr());

        // Anyone can submit; use the admin's broadcast as the relayer to
        // keep the payer key signature-only. On the hosted checkout this
        // would be the Strimz API's KMS-backed relayer.
        vm.startBroadcast(adminKey);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(uint256(0xE2E3)), v, r, s
        );
        vm.stopBroadcast();

        uint256 payerAfter = usdc.balanceOf(payer);
        uint256 payoutAfter = usdc.balanceOf(merchantPayout);
        uint256 feeAfter = usdc.balanceOf(_feeCollectorAddr());

        require(payerBefore - payerAfter == gross, "stage 3: payer delta mismatch");
        require(payoutAfter - payoutBefore == expectedNet, "stage 3: payout delta mismatch");
        require(feeAfter - feeBefore == expectedFee, "stage 3: fee delta mismatch");
        require(usdc.authorizationState(payer, auth.nonce), "stage 3: nonce should be marked used");

        console2.log("  relayer (broadcaster) ", admin);
        console2.log("  payer signed; never sent a tx");
        console2.log("  payer    paid         ", gross);
        console2.log("  merchant got          ", expectedNet);
        console2.log("  fees     took         ", expectedFee);
        console2.log("[ok] stage 3");
        console2.log("");
    }

    function _stageSubscriptionViaPermit() private returns (uint256 subId) {
        console2.log("[4] subscription via EIP-2612 permitAndCreateSubscription");
        uint256 amount = ONE_USDC;
        uint32 interval = 60; // 60-second period, fine for smoke testing.
        uint64 startAt = 0;
        uint64 endAt = 0;
        // Grant the contract unlimited allowance so the scheduler can
        // pull every period without re-permits. This mirrors the
        // hosted-checkout wire format.
        uint256 permitValue = type(uint256).max;
        uint256 deadline = block.timestamp + 1 hours;

        IStrimzSubscriptions.PermitData memory permitData = IStrimzSubscriptions.PermitData({
            owner: payer,
            value: permitValue,
            deadline: deadline
        });
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(address(subs), permitValue, deadline);

        vm.startBroadcast(adminKey);
        subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), amount, interval, startAt, endAt, permitData, v, r, s
        );
        vm.stopBroadcast();

        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(subId);
        require(sub.payer == payer, "stage 4: payer mismatch");
        require(uint256(sub.merchantId) == merchantId, "stage 4: merchantId mismatch");
        require(sub.token == address(usdc), "stage 4: token mismatch");
        require(sub.amount == amount, "stage 4: amount mismatch");
        require(sub.interval == interval, "stage 4: interval mismatch");
        require(!sub.cancelled, "stage 4: should not be cancelled at creation");

        console2.log("  subscriptionId ", subId);
        console2.log("  amount         ", amount);
        console2.log("  interval (s)   ", interval);
        console2.log("  nextChargeAt   ", uint256(sub.nextChargeAt));
        console2.log("[ok] stage 4");
        console2.log("");
    }

    function _stageCancelSubscription(uint256 subId) private {
        console2.log("[5] merchant cancels the subscription from their own wallet");
        console2.log("  caller (merchant) ", merchant);

        vm.startBroadcast(merchantKey);
        subs.cancel(subId);
        vm.stopBroadcast();

        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(subId);
        require(sub.cancelled, "stage 5: should be cancelled");
        console2.log("  cancelled flag    ", sub.cancelled);
        console2.log("[ok] stage 5");
        console2.log("");
    }

    // ============================================================
    // Helpers
    // ============================================================

    function _loadEnv() private {
        adminKey = vm.envUint("STRIMZ_DEPLOYER_PRIVATE_KEY");
        admin = vm.addr(adminKey);

        merchantKey = vm.envUint("STRIMZ_MERCHANT_PRIVATE_KEY");
        merchant = vm.addr(merchantKey);

        payerKey = vm.envUint("STRIMZ_PAYER_PRIVATE_KEY");
        payer = vm.addr(payerKey);

        // The three actors model Strimz (admin), the merchant, and the
        // payer in production. Collapsing any two of them onto the same
        // address would let role-side asserts pass for the wrong reason.
        require(admin != merchant, "admin and merchant must be different addresses");
        require(admin != payer, "admin and payer must be different addresses");
        require(merchant != payer, "merchant and payer must be different addresses");

        merchantPayout = vm.envAddress("STRIMZ_MERCHANT_PAYOUT_ADDRESS");

        registry = IStrimzRegistry(vm.envAddress("STRIMZ_REGISTRY_ADDRESS"));
        whitelist = ITokenWhitelist(vm.envAddress("STRIMZ_TOKEN_WHITELIST_ADDRESS"));
        payments = IStrimzPayments(vm.envAddress("STRIMZ_PAYMENTS_ADDRESS"));
        subs = IStrimzSubscriptions(vm.envAddress("STRIMZ_SUBSCRIPTIONS_ADDRESS"));
        usdc = IUSDC(vm.envAddress("ARC_USDC_ADDRESS"));
    }

    function _printHeader() private view {
        console2.log("=== Strimz on-chain end-to-end ===");
        console2.log("chainId           ", block.chainid);
        console2.log("Strimz (admin)    ", admin);
        console2.log("merchant (owner)  ", merchant);
        console2.log("merchant payout   ", merchantPayout);
        console2.log("payer             ", payer);
        console2.log("USDC              ", address(usdc));
        console2.log("Registry          ", address(registry));
        console2.log("Payments          ", address(payments));
        console2.log("Subscriptions     ", address(subs));
        console2.log("");
        console2.log("Initial balances (raw, 6 decimals):");
        console2.log("  payer USDC      ", usdc.balanceOf(payer));
        console2.log("  merchant USDC   ", usdc.balanceOf(merchant));
        console2.log("  payout USDC     ", usdc.balanceOf(merchantPayout));
        console2.log("  FeeCollector    ", usdc.balanceOf(_feeCollectorAddr()));
        console2.log("");
    }

    function _feeCollectorAddr() private view returns (address) {
        // Read once from env. The Verify script already confirmed this is
        // the address Payments + Subscriptions credit fees to.
        return vm.envAddress("STRIMZ_FEE_COLLECTOR_ADDRESS");
    }

    function _requirePayerHasAtLeast(uint256 amount, string memory stage) private view {
        uint256 bal = usdc.balanceOf(payer);
        if (bal < amount) {
            console2.log(
                "Payer balance too low. Top up via https://faucet.circle.com (Arc testnet)."
            );
            console2.log("  payer       ", payer);
            console2.log("  current bal ", bal);
            console2.log("  required    ", amount);
            revert(string.concat(stage, ": insufficient payer USDC"));
        }
    }

    function _signReceiveWithAuthorization(IStrimzPayments.PayAuthorization memory auth)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                usdc.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                auth.from,
                address(payments),
                auth.amount,
                auth.validAfter,
                auth.validBefore,
                auth.nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(payerKey, digest);
    }

    function _signPermit(address spender, uint256 value, uint256 deadline)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        uint256 nonce = usdc.nonces(payer);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, spender, value, nonce, deadline));
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(payerKey, digest);
    }
}
