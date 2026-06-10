// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
        feeCollector.grantRole(StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.stopPrank();

        _fund(payer, 10_000_000_000);
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
    }

    function _createSub(uint256 amount) internal returns (uint256) {
        vm.prank(payer);
        return subs.createSubscription(
            merchantId, address(usdc), amount, 1 hours, uint64(block.timestamp), 0
        );
    }

    function test_chargeRejectsDuplicateAttemptId() public {
        uint256 id = _createSub(50_000_000);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt-1");

        vm.startPrank(admin);
        subs.batchCharge(ids, attempts);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzSubscriptions.Subscriptions__DuplicateAttempt.selector, attempts[0]
            )
        );
        subs.batchCharge(ids, attempts);
        vm.stopPrank();
    }

    function test_cancelledSubscriptionProducesCancelledOutcome() public {
        uint256 id = _createSub(50_000_000);
        vm.prank(payer);
        subs.cancel(id);

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt-cancelled");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Cancelled));
    }

    function test_happyPathChargesAndAdvancesNextChargeAt() public {
        uint256 id = _createSub(50_000_000);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt-happy");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);

        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));
        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(id);
        assertEq(sub.nextChargeAt, uint64(block.timestamp) + 1 hours);
        assertGt(usdc.balanceOf(merchantPayout), 0);
        assertGt(usdc.balanceOf(address(feeCollector)), 0);
    }

    function test_lengthMismatchReverts() public {
        uint256[] memory ids = new uint256[](1);
        bytes32[] memory attempts = new bytes32[](2);

        vm.prank(admin);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__LengthMismatch.selector);
        subs.batchCharge(ids, attempts);
    }

    function test_uninitialisedOutcomeIsNoneNotCharged() public pure {
        // Default storage value of any uninitialised ChargeOutcome must be
        // None — ensures the zero-value-defaults-to-Charged vulnerability
        // class is structurally impossible.
        IStrimzSubscriptions.ChargeOutcome zero;
        assertEq(uint256(zero), uint256(IStrimzSubscriptions.ChargeOutcome.None));
    }

    function _assertOutcomeNoneIsZero(uint256 v) internal pure {
        assert(v == uint256(IStrimzSubscriptions.ChargeOutcome.None));
    }
}
