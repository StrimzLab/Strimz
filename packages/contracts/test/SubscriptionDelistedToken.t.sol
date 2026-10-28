// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SubscriptionIntentNonceTest } from "./SubscriptionIntentNonce.t.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { MockUsdc } from "./Helpers.t.sol";

contract SubscriptionDelistedTokenTest is SubscriptionIntentNonceTest {
    bytes32 internal constant ATTEMPT = keccak256("delisted-1");

    function _subscribe() internal returns (uint256 subId) {
        vm.startPrank(payer);
        usdc.approve(address(subs), type(uint256).max);
        subId = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
        vm.stopPrank();
    }

    function _chargeOne(uint256 subId, bytes32 attempt) internal returns (IStrimzSubscriptions.ChargeOutcome) {
        uint256[] memory ids = new uint256[](1);
        ids[0] = subId;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = attempt;
        vm.prank(admin);
        return subs.batchCharge(ids, attempts)[0];
    }

    function _delist() internal {
        vm.prank(admin);
        whitelist.remove(address(usdc));
    }

    function test_delistedTokenIsNotCharged() public {
        uint256 subId = _subscribe();
        _delist();
        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 merchantBefore = usdc.balanceOf(merchantPayout);
        uint64 nextBefore = subs.getSubscription(subId).nextChargeAt;

        vm.expectEmit(true, false, false, true, address(subs));
        emit IStrimzSubscriptions.SubscriptionChargeSkipped(
            subId, ATTEMPT, IStrimzSubscriptions.ChargeOutcome.TokenNotAllowed
        );
        IStrimzSubscriptions.ChargeOutcome out = _chargeOne(subId, ATTEMPT);

        assertEq(uint8(out), uint8(IStrimzSubscriptions.ChargeOutcome.TokenNotAllowed));
        assertEq(usdc.balanceOf(payer), payerBefore, "payer not charged");
        assertEq(usdc.balanceOf(merchantPayout), merchantBefore, "merchant not paid");
        assertEq(subs.getSubscription(subId).nextChargeAt, nextBefore, "period not advanced");
        assertFalse(subs.isAttemptUsed(ATTEMPT), "attempt id stays retryable");
    }

    function test_reWhitelistedTokenResumesWithoutBackBilling() public {
        uint256 subId = _subscribe();
        assertEq(uint8(_chargeOne(subId, ATTEMPT)), uint8(IStrimzSubscriptions.ChargeOutcome.Charged));

        _delist();
        vm.warp(block.timestamp + INTERVAL);
        bytes32 second = keccak256("delisted-2");
        assertEq(uint8(_chargeOne(subId, second)), uint8(IStrimzSubscriptions.ChargeOutcome.TokenNotAllowed));

        vm.warp(block.timestamp + 2 * INTERVAL);
        vm.prank(admin);
        whitelist.add(address(usdc));
        uint256 payerBefore = usdc.balanceOf(payer);

        vm.expectEmit(true, false, false, true, address(subs));
        emit IStrimzSubscriptions.SubscriptionPeriodsSkipped(
            subId, 2, subs.getSubscription(subId).nextChargeAt + 2 * INTERVAL
        );
        assertEq(uint8(_chargeOne(subId, second)), uint8(IStrimzSubscriptions.ChargeOutcome.Charged));
        assertEq(payerBefore - usdc.balanceOf(payer), AMOUNT, "one period only");
    }

    function test_batchChargesOnlyRowsInAllowedTokens() public {
        uint256 delisted = _subscribe();

        MockUsdc other = new MockUsdc();
        other.mint(payer, AMOUNT * 2);
        vm.startPrank(admin);
        whitelist.add(address(other));
        whitelist.remove(address(usdc));
        vm.stopPrank();
        vm.startPrank(payer);
        other.approve(address(subs), type(uint256).max);
        uint256 allowed = subs.createSubscription(merchantId, address(other), AMOUNT, INTERVAL, 0, 0);
        vm.stopPrank();

        uint256[] memory ids = new uint256[](2);
        ids[0] = delisted;
        ids[1] = allowed;
        bytes32[] memory attempts = new bytes32[](2);
        attempts[0] = keccak256("row-0");
        attempts[1] = keccak256("row-1");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory out = subs.batchCharge(ids, attempts);

        assertEq(uint8(out[0]), uint8(IStrimzSubscriptions.ChargeOutcome.TokenNotAllowed));
        assertEq(uint8(out[1]), uint8(IStrimzSubscriptions.ChargeOutcome.Charged));
    }

    function test_tokenNotAllowedIsAppendedAsEleven() public pure {
        assertEq(uint8(IStrimzSubscriptions.ChargeOutcome.TransferFailed), 10);
        assertEq(uint8(IStrimzSubscriptions.ChargeOutcome.TokenNotAllowed), 11);
    }
}
