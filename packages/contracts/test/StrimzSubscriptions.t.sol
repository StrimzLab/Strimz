// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzSubscriptions.t
/// @notice Subscriptions is the highest-risk surface in the platform:
///         a recurring off-chain scheduler charges on-chain, so any
///         path where a single bad row silently reverts a whole batch
///         is a direct availability + revenue bug.
///
///         What we prove:
///           1. Happy path: subscription enrols, first charge fires,
///              nextChargeAt advances by one interval.
///           2. Idempotency: an attempt id is spent on first use; a
///              duplicate returns Duplicate, never re-charges.
///           3. Batch resilience: unknown ids, inactive merchants,
///              cancelled subs, insufficient allowance or funds, past
///              endAt — none revert the batch. Each is a per-row outcome.
///           4. Cap: MAX_BATCH_SIZE stops a mis-configured scheduler
///              from OOG'ing mid-loop.
///           5. Enum floor: uninitialised outcome slots decode as None,
///              not Charged — protecting against silent-fund-loss
///              zero-defaulting.

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

contract StrimzSubscriptionsTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;

    function setUp() public {
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(),
            address(subs)
        );
        merchantId = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.stopPrank();

        _fund(payer, 10_000_000_000);
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
    }

    // ---------- Happy path ----------

    // First charge fires, splits fee vs net correctly, advances the
    // clock. This is the money path for the whole business — if this
    // breaks, subscriptions are broken.
    function test_happyPathChargesAndAdvancesClock() public {
        uint256 id = _createSub(50_000_000);

        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "attempt-happy");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);

        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));

        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(id);
        assertEq(sub.nextChargeAt, uint64(block.timestamp) + 1 hours);

        // 1 % fee against 50 USDC → 0.5 USDC to collector, 49.5 to merchant.
        assertEq(usdc.balanceOf(address(feeCollector)), 500_000);
        assertEq(usdc.balanceOf(merchantPayout), 49_500_000);
    }

    // ---------- Idempotency ----------

    // Same attempt id twice: first succeeds, second returns Duplicate.
    // Under no circumstance can the payer be charged twice for one id.
    function test_duplicateAttemptIdIsPerRowNotBatchRevert() public {
        uint256 id = _createSub(50_000_000);

        uint256[] memory ids = new uint256[](2);
        bytes32[] memory attempts = new bytes32[](2);
        ids[0] = id;
        ids[1] = id;
        bytes32 same = keccak256("dup");
        attempts[0] = same;
        attempts[1] = same;

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));
        assertEq(uint256(outcomes[1]), uint256(IStrimzSubscriptions.ChargeOutcome.Duplicate));

        // Merchant balance reflects exactly one charge.
        assertEq(usdc.balanceOf(merchantPayout), 49_500_000);
    }

    // ---------- Per-row outcomes (no batch revert) ----------

    // A row referencing an unknown subscription must not take out the
    // batch. Scheduler race between cancel + submit could otherwise
    // burn every co-batched row.
    function test_unknownSubscriptionYieldsUnknownOutcome() public {
        uint256 real = _createSub(50_000_000);

        uint256[] memory ids = new uint256[](2);
        bytes32[] memory attempts = new bytes32[](2);
        ids[0] = real;
        ids[1] = 999_999; // never existed
        attempts[0] = keccak256("real");
        attempts[1] = keccak256("phantom");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));
        assertEq(uint256(outcomes[1]), uint256(IStrimzSubscriptions.ChargeOutcome.Unknown));
    }

    // Admin freezing a merchant between batch queue and execution must
    // only drop that merchant's rows. Others still settle.
    function test_merchantInactiveDropsOnlyAffectedRow() public {
        uint256 subA = _createSub(50_000_000);

        vm.prank(admin);
        uint256 merchantB = registry.registerMerchant(makeAddr("mB"), makeAddr("payB"), 100, 0);
        address payerB = makeAddr("payerB");
        _fund(payerB, 10_000_000_000);
        vm.prank(payerB);
        usdc.approve(address(subs), type(uint256).max);
        vm.prank(payerB);
        uint256 subB = subs.createSubscription(
            merchantB, address(usdc), 60_000_000, 1 hours, uint64(block.timestamp), 0
        );

        vm.prank(admin);
        registry.setActive(merchantId, false); // freeze merchant A

        uint256[] memory ids = new uint256[](2);
        bytes32[] memory attempts = new bytes32[](2);
        ids[0] = subA;
        ids[1] = subB;
        attempts[0] = keccak256("frozen");
        attempts[1] = keccak256("healthy");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);

        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.MerchantInactive));
        assertEq(uint256(outcomes[1]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));

        assertGt(usdc.balanceOf(makeAddr("payB")), 0, "healthy merchant paid");
        assertEq(usdc.balanceOf(merchantPayout), 0, "frozen merchant received nothing");
    }

    // Cancelled subs surface as Cancelled, batch continues.
    function test_cancelledSubscriptionYieldsCancelledOutcome() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(payer);
        subs.cancel(id);

        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "after-cancel");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Cancelled));
        assertEq(usdc.balanceOf(merchantPayout), 0);
    }

    // Insufficient payer allowance is a per-row outcome, not a revert.
    function test_revokedApprovalYieldsRevokedOutcome() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(payer);
        usdc.approve(address(subs), 0);

        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "no-allowance");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.RevokedApproval));
    }

    // Insufficient payer balance is a per-row outcome, not a revert.
    function test_insufficientFundsYieldsOutcome() public {
        uint256 id = _createSub(50_000_000);
        // Cache the balance + sink before pranking — vm.prank only
        // carries to the next external call.
        uint256 balance = usdc.balanceOf(payer);
        address sink = makeAddr("sink");
        vm.prank(payer);
        usdc.transfer(sink, balance);

        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "no-funds");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.InsufficientFunds));
    }

    // Charges before nextChargeAt do not fire.
    function test_chargingEarlyReturnsNotDue() public {
        uint64 startAt = uint64(block.timestamp + 1 days);
        vm.prank(payer);
        uint256 id = subs.createSubscription(merchantId, address(usdc), 50_000_000, 1 hours, startAt, 0);

        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "too-early");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.NotDue));
    }

    // Past endAt: subscription is terminated for charging purposes.
    function test_pastEndAtReturnsEnded() public {
        uint64 startAt = uint64(block.timestamp);
        uint64 endAt = uint64(block.timestamp + 2 hours);
        vm.prank(payer);
        uint256 id = subs.createSubscription(merchantId, address(usdc), 50_000_000, 1 hours, startAt, endAt);

        vm.warp(block.timestamp + 3 hours);
        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(id, "after-end");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Ended));
    }

    // ---------- Access control ----------

    // Only CHARGER_ROLE can call batchCharge. If this ever loosens, a
    // random EOA could grief the scheduler by burning attempt ids.
    function test_batchChargeGatedByChargerRole() public {
        (uint256[] memory ids, bytes32[] memory attempts) = _oneRow(_createSub(1_000), "unauthorised");
        address random = makeAddr("random");
        vm.expectRevert();
        vm.prank(random);
        subs.batchCharge(ids, attempts);
    }

    // ---------- Batch size guard ----------

    function test_batchTooLargeReverts() public {
        // Cache the constant before pranking — vm.prank only sticks to
        // the next external call, and an extra `subs.MAX_BATCH_SIZE()`
        // inside the expectRevert eats it.
        uint256 cap = subs.MAX_BATCH_SIZE();
        uint256 tooMany = cap + 1;
        uint256[] memory ids = new uint256[](tooMany);
        bytes32[] memory attempts = new bytes32[](tooMany);
        bytes memory expected = abi.encodeWithSelector(
            bytes4(keccak256("Subscriptions__BatchTooLarge(uint256,uint256)")),
            tooMany,
            cap
        );
        vm.expectRevert(expected);
        vm.prank(admin);
        subs.batchCharge(ids, attempts);
    }

    // ---------- Length matching ----------

    function test_lengthMismatchReverts() public {
        uint256[] memory ids = new uint256[](1);
        bytes32[] memory attempts = new bytes32[](2);
        vm.prank(admin);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__LengthMismatch.selector);
        subs.batchCharge(ids, attempts);
    }

    // ---------- Enum sanity ----------

    // Zero-value slots MUST decode as None. If someone reorders the
    // enum and Charged becomes index 0, uninitialised memory reads as
    // "yes we paid this" — silent fund-loss class.
    function test_uninitialisedOutcomeIsNoneNotCharged() public pure {
        IStrimzSubscriptions.ChargeOutcome zero;
        assertEq(uint256(zero), uint256(IStrimzSubscriptions.ChargeOutcome.None));
    }

    // ---------- Cancel semantics ----------

    // Payer can cancel their own sub.
    function test_payerCanCancel() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(payer);
        subs.cancel(id);
        assertTrue(subs.getSubscription(id).cancelled);
    }

    // Merchant owner can also cancel (support flow — e.g. refund cases).
    function test_merchantOwnerCanCancel() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(merchant);
        subs.cancel(id);
        assertTrue(subs.getSubscription(id).cancelled);
    }

    // No one else can.
    function test_thirdPartyCannotCancel() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(makeAddr("random"));
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__NotSubscriptionParty.selector);
        subs.cancel(id);
    }

    // ---------- Create validation ----------

    // Sub-hour intervals are cheap DoS on the payer's gas — block them.
    function test_createRejectsIntervalBelowMinimum() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidInterval.selector);
        subs.createSubscription(
            merchantId, address(usdc), 50_000_000, 59 minutes, uint64(block.timestamp), 0
        );
    }

    function test_createRejectsZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidAmount.selector);
        subs.createSubscription(merchantId, address(usdc), 0, 1 hours, uint64(block.timestamp), 0);
    }

    function test_createRejectsEndBeforeStart() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidEndAt.selector);
        subs.createSubscription(
            merchantId, address(usdc), 50_000_000, 1 hours, uint64(block.timestamp), uint64(block.timestamp)
        );
    }

    function test_createRejectsUnwhitelistedToken() public {
        address rogue = makeAddr("rogueToken");
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__InvalidToken.selector, rogue));
        subs.createSubscription(merchantId, rogue, 50_000_000, 1 hours, uint64(block.timestamp), 0);
    }

    // ---------- Helpers ----------

    function _createSub(uint256 amount) internal returns (uint256) {
        vm.prank(payer);
        return subs.createSubscription(
            merchantId, address(usdc), amount, 1 hours, uint64(block.timestamp), 0
        );
    }

    function _oneRow(uint256 id, string memory tag)
        internal
        pure
        returns (uint256[] memory ids, bytes32[] memory attempts)
    {
        ids = new uint256[](1);
        ids[0] = id;
        attempts = new bytes32[](1);
        attempts[0] = keccak256(bytes(tag));
    }
}
