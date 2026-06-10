// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase, MockUsdc } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

/// @title StrimzSubscriptionsPermitTest
/// @notice Coverage for the EIP-2612 `permitAndCreateSubscription`
///         entrypoint. Asserts that (1) one signed permit grants the
///         allowance AND creates the subscription atomically, (2) the
///         subscription's `payer` field comes from the permit owner
///         rather than `msg.sender` (so a relayer can submit), and (3)
///         every path-specific revert fires for the corresponding bad
///         input. Fee-split arithmetic and the charge state machine are
///         covered by the canonical `StrimzSubscriptions.t.sol` against
///         the classic `createSubscription` flow.
contract StrimzSubscriptionsPermitTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;

    uint16 internal constant FEE_BPS = 100;
    uint256 internal constant AMOUNT = 50_000_000; // 50 mUSDC per period
    uint32 internal constant INTERVAL = 1 hours;
    address internal relayer;

    function setUp() public {
        relayer = makeAddr("relayer");
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), whitelist.CAP_PERMIT_2612());
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(subs)
        );
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopPrank();

        _fund(payer, 10_000_000_000);
        // No `usdc.approve` — that's what the permit signature replaces.
    }

    // ----- Helpers -----

    function _defaultPermit(uint256 value, uint256 deadline)
        internal
        view
        returns (IStrimzSubscriptions.PermitData memory)
    {
        return IStrimzSubscriptions.PermitData({
            owner: payer,
            value: value,
            deadline: deadline
        });
    }

    function _signPermitForSubs(IStrimzSubscriptions.PermitData memory pd, uint256 signerPk)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        return _signPermit(usdc, signerPk, pd.owner, address(subs), pd.value, pd.deadline);
    }

    // ----- Happy path -----

    function test_permitAndCreateSubscription_happyPath_grantsAllowanceAndCreates() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );

        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max, "allowance set by permit");

        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(subId);
        assertEq(sub.payer, payer, "payer == permit owner, NOT relayer");
        assertEq(sub.token, address(usdc));
        assertEq(sub.amount, AMOUNT);
        assertEq(sub.interval, INTERVAL);
        assertEq(sub.merchantId, uint96(merchantId));
        assertEq(sub.endAt, 0, "open-ended");
        assertFalse(sub.cancelled);
    }

    function test_permitAndCreateSubscription_chargeWithPermittedAllowanceSucceeds() public {
        // End-to-end smoke: one signature enrolls; the scheduler can then
        // charge that subscription with no further customer action.
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );

        uint256[] memory ids = new uint256[](1);
        ids[0] = subId;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt-1");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));

        uint256 expectedFee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(usdc.balanceOf(merchantPayout), AMOUNT - expectedFee);
        assertEq(usdc.balanceOf(address(feeCollector)), expectedFee);
    }

    function test_permitAndCreateSubscription_payerCanCancelEvenWhenRelayerCreated() public {
        // Establishes that cancel rights belong to the permit owner, not
        // the relayer that submitted the create. Critical for consumer
        // protection: a malicious relayer cannot lock the customer in.
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );

        // Relayer cannot cancel.
        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__NotSubscriptionParty.selector);
        subs.cancel(subId);

        // Payer can.
        vm.prank(payer);
        subs.cancel(subId);
        assertTrue(subs.getSubscription(subId).cancelled);
    }

    // ----- Path-specific reverts -----

    function test_permitAndCreateSubscription_zeroAmount_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidAmount.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), 0, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );
    }

    function test_permitAndCreateSubscription_intervalTooShort_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidInterval.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, 60, uint64(block.timestamp), 0, pd, v, r, s
        );
    }

    function test_permitAndCreateSubscription_invalidEndAt_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        // endAt <= startAt is meaningless — must revert.
        uint64 startAt = uint64(block.timestamp + 1 hours);
        uint64 endAt = startAt; // equal, should fail

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidEndAt.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, endAt, pd, v, r, s
        );
    }

    function test_permitAndCreateSubscription_unwhitelistedToken_reverts() public {
        MockUsdc other = new MockUsdc();
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        // Signature doesn't matter — whitelist check runs before token.permit.

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzSubscriptions.Subscriptions__InvalidToken.selector, address(other)
            )
        );
        subs.permitAndCreateSubscription(
            merchantId,
            address(other),
            AMOUNT,
            INTERVAL,
            uint64(block.timestamp),
            0,
            pd,
            27,
            bytes32(0),
            bytes32(0)
        );
    }

    function test_permitAndCreateSubscription_tokenWithoutCapability_reverts() public {
        MockUsdc plain = new MockUsdc();
        vm.startPrank(admin);
        whitelist.add(address(plain));
        // Deliberately NOT setting CAP_PERMIT_2612.
        vm.stopPrank();

        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzSubscriptions.Subscriptions__UnsupportedCapability.selector, address(plain)
            )
        );
        subs.permitAndCreateSubscription(
            merchantId,
            address(plain),
            AMOUNT,
            INTERVAL,
            uint64(block.timestamp),
            0,
            pd,
            27,
            bytes32(0),
            bytes32(0)
        );
    }

    function test_permitAndCreateSubscription_invalidSignature_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        // Sign with the WRONG key — OZ's ERC20Permit will revert on mismatch.
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, attackerPk);

        vm.prank(relayer);
        // OZ's ERC20Permit reverts with ERC2612InvalidSigner(recovered, owner)
        // — we don't pin the exact selector here because the upstream error
        // can change between OZ versions; a bare revert is sufficient evidence.
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );
    }

    function test_permitAndCreateSubscription_expiredDeadline_reverts() public {
        // Deadline already past at submit time — ERC20Permit must reject.
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, 1);
        // Move the clock past the deadline.
        vm.warp(100);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );
    }

    function test_permitAndCreateSubscription_paused_reverts() public {
        vm.prank(admin);
        subs.pause();

        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        (uint8 v, bytes32 r, bytes32 s) = _signPermitForSubs(pd, payerPk);

        vm.prank(relayer);
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, v, r, s
        );
    }
}
