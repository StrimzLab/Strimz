// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SubscriptionIntentNonceTest } from "./SubscriptionIntentNonce.t.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

contract SubscriptionIntentPermitValueTest is SubscriptionIntentNonceTest {
    bytes internal constant JUNK_SIG =
        abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), uint8(27));

    function test_zeroValueFrontRunCannotEnrolAndRelayerStillSucceeds() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        bytes memory permitSig = _permitSig(pd);
        bytes memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        IStrimzSubscriptions.PermitData memory zero = _permitData(0, deadline);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__PermitBelowAmount.selector, 0, AMOUNT)
        );
        vm.prank(attacker);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, zero, JUNK_SIG, intentSig
        );

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
        assertEq(subs.getSubscription(subId).payer, payer);
        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max, "the payer's permit ran");
    }

    function test_permitValueOtherThanSignedReverts() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        bytes memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        // An earlier approval covers any value, so only the signed value can stop this.
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);

        IStrimzSubscriptions.PermitData memory other = _permitData(AMOUNT, deadline);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        vm.prank(attacker);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, other, JUNK_SIG, intentSig
        );
    }

    function test_permitBelowOneChargeReverts() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(AMOUNT - 1, deadline);
        bytes memory permitSig = _permitSig(pd);
        bytes memory intentSig = _intentSigFor(payerPk, startAt, deadline, AMOUNT - 1, NONCE);

        vm.expectRevert(
            abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__PermitBelowAmount.selector, AMOUNT - 1, AMOUNT)
        );
        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
    }

    function test_boundedPermitSignedInIntentEnrols() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(AMOUNT * 12, deadline);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId,
            address(usdc),
            AMOUNT,
            INTERVAL,
            startAt,
            0,
            NONCE,
            pd,
            _permitSig(pd),
            _intentSigFor(payerPk, startAt, deadline, AMOUNT * 12, NONCE)
        );
        assertEq(subs.getSubscription(subId).payer, payer);
        assertEq(usdc.allowance(payer, address(subs)), AMOUNT * 12);
    }

    function test_frontRunWithPayersOwnPermitStillEnrols() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        bytes memory permitSig = _permitSig(pd);
        bytes memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        vm.prank(attacker);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );

        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__IntentAlreadyUsed.selector, NONCE));
        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max, "the payer got what they signed");
    }
}
