// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase, MockErc1271Wallet } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

/// Audit 2026-11-19: M-02, L-08, L-03/L-06, L-12.
contract MainnetAuditFixesTest is StrimzTestBase {
    uint256 internal constant AMOUNT = 50_000_000;
    uint32 internal constant INTERVAL = 1 hours;
    bytes32 internal constant NONCE = keccak256("intent");

    StrimzRegistry internal registry;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;
    address internal relayer;

    function setUp() public {
        relayer = makeAddr("relayer");
        _setUpTokens();
        registry = _deployRegistry(admin);
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        FeeCollector feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        bytes32 accruer = feeCollector.FEE_ACCRUER_ROLE();
        bytes32 cancellerRole = subs.SUBSCRIPTION_CANCELLER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), whitelist.CAP_PERMIT_2612());
        feeCollector.grantRole(accruer, address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, 100, 100, 0);
        subs.grantRole(cancellerRole, _canceller());
        vm.stopPrank();
        _fund(payer, 1000 * AMOUNT);
    }

    function _canceller() internal returns (address) {
        return makeAddr("cancellerOnly");
    }

    function _intentSig(uint256 pk, address forPayer, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signSubscriptionIntent(
            subs, pk, forPayer, merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, deadline, type(uint256).max, NONCE
        );
        return abi.encodePacked(r, s, v);
    }

    function _enrol(address owner, uint256 deadline, bytes memory permitSig, bytes memory intentSig)
        internal
        returns (uint256)
    {
        IStrimzSubscriptions.PermitData memory pd =
            IStrimzSubscriptions.PermitData({ owner: owner, value: type(uint256).max, deadline: deadline });
        vm.prank(relayer);
        return subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, NONCE, pd, permitSig, intentSig
        );
    }

    // ---------- M-02: the signed deadline binds the allowance path too ----------

    function test_expiredIntentIsRefusedEvenWithAStandingAllowance() public {
        vm.warp(10 days);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory intentSig = _intentSig(payerPk, payer, deadline);
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(usdc, payerPk, payer, address(subs), type(uint256).max, deadline);

        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
        vm.warp(deadline + 30 days);

        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__PermitExpired.selector, deadline));
        _enrol(payer, deadline, abi.encodePacked(r, s, v), intentSig);
    }

    // ---------- L-08: an intent can't enrol a sibling wallet ----------

    function test_intentForOneWalletCannotEnrolASiblingWallet() public {
        (address owner, uint256 ownerPk) = makeAddrAndKey("walletOwner");
        MockErc1271Wallet first = new MockErc1271Wallet(owner);
        MockErc1271Wallet sibling = new MockErc1271Wallet(owner);
        _fund(address(sibling), 10 * AMOUNT);
        vm.prank(address(sibling));
        usdc.approve(address(subs), type(uint256).max);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory intentForFirst = _intentSig(ownerPk, address(first), deadline);

        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        _enrol(address(sibling), deadline, hex"", intentForFirst);
    }

    function test_intentEnrolsTheWalletItNames() public {
        (address owner, uint256 ownerPk) = makeAddrAndKey("walletOwner");
        MockErc1271Wallet wallet = new MockErc1271Wallet(owner);
        _fund(address(wallet), 10 * AMOUNT);
        vm.prank(address(wallet));
        usdc.approve(address(subs), type(uint256).max);

        uint256 deadline = block.timestamp + 1 hours;
        uint256 id = _enrol(address(wallet), deadline, hex"", _intentSig(ownerPk, address(wallet), deadline));
        assertEq(subs.getSubscription(id).payer, address(wallet));
    }

    // ---------- L-03 / L-06: a sale freezes payout changes ----------

    function test_payoutQueuedBeforeASaleCannotBeCommittedDuringIt() public {
        address sellerWallet = makeAddr("sellerWallet");
        address buyer = makeAddr("buyer");

        vm.prank(merchant);
        registry.setPayoutAddress(merchantId, sellerWallet);
        vm.warp(block.timestamp + 23 hours);
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, buyer);
        vm.warp(block.timestamp + 2 hours);

        vm.expectRevert(IStrimzRegistry.Registry__NoPendingPayoutChange.selector);
        registry.commitPayoutAddress(merchantId);

        vm.warp(block.timestamp + 1 days);
        vm.prank(buyer);
        registry.acceptMerchantOwnership(merchantId);
        assertEq(registry.getMerchant(merchantId).payoutAddress, merchantPayout, "buyer keeps the payout it saw");
    }

    function test_payoutCannotBeQueuedDuringASale() public {
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, makeAddr("buyer"));

        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__OwnershipTransferPending.selector);
        registry.setPayoutAddress(merchantId, makeAddr("sellerWallet"));
    }

    function test_payoutChangesAgainAfterTheSaleIsCancelled() public {
        vm.startPrank(merchant);
        registry.transferMerchantOwnership(merchantId, makeAddr("buyer"));
        registry.cancelOwnershipTransfer(merchantId);
        registry.setPayoutAddress(merchantId, makeAddr("newWallet"));
        vm.stopPrank();
        assertEq(registry.getMerchant(merchantId).pendingPayoutAddress, makeAddr("newWallet"));
    }

    // ---------- L-12: the payer's own cancel blocks a reinstate ----------

    function test_payerCancelAfterOperatorCancelBlocksReinstate() public {
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
        vm.prank(payer);
        uint256 id = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);

        vm.prank(_canceller());
        subs.cancel(id);

        vm.expectEmit(true, true, false, false, address(subs));
        emit IStrimzSubscriptions.SubscriptionCancelConfirmedByPayer(id, payer);
        vm.prank(payer);
        subs.cancel(id);
        assertEq(subs.operatorCancelledAt(id), 0);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, id));
        subs.reinstate(id);
    }

    function test_strangerStillCannotCancelTwice() public {
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
        vm.prank(payer);
        uint256 id = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
        vm.prank(_canceller());
        subs.cancel(id);

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__AlreadyCancelled.selector, id));
        subs.cancel(id);
    }

    // ---------- #497: the signup's nonce is on the event ----------

    function test_permitEnrolmentEmitsItsIntentNonce() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(usdc, payerPk, payer, address(subs), type(uint256).max, deadline);
        vm.expectEmit(true, true, true, true, address(subs));
        emit IStrimzSubscriptions.SubscriptionCreated(
            1, merchantId, payer, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), NONCE
        );
        _enrol(payer, deadline, abi.encodePacked(r, s, v), _intentSig(payerPk, payer, deadline));
    }

    function test_directEnrolmentEmitsAZeroNonce() public {
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
        vm.expectEmit(true, true, true, true, address(subs));
        emit IStrimzSubscriptions.SubscriptionCreated(
            1, merchantId, payer, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), bytes32(0)
        );
        vm.prank(payer);
        subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
    }

    // ---------- #499: a relayer cancels for the payer ----------

    function _directSub(address who) internal returns (uint256 id) {
        vm.prank(who);
        usdc.approve(address(subs), type(uint256).max);
        vm.prank(who);
        id = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
    }

    function _cancelSig(uint256 pk, uint256 id, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, subs.cancelDigest(id, deadline));
        return abi.encodePacked(r, s, v);
    }

    function test_relayerCancelsWithThePayersSignature() public {
        uint256 id = _directSub(payer);
        uint256 deadline = block.timestamp + 30 minutes;

        bytes memory sig = _cancelSig(payerPk, id, deadline);

        vm.expectEmit(true, true, false, false, address(subs));
        emit IStrimzSubscriptions.SubscriptionCancelled(id, payer);
        vm.prank(relayer);
        subs.cancelWithSig(id, deadline, sig);

        assertTrue(subs.getSubscription(id).cancelled);
        assertEq(subs.operatorCancelledAt(id), 0, "a payer cancel is not reinstatable");
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, id));
        subs.reinstate(id);
    }

    function test_contractWalletCancelsWithItsOwnersSignature() public {
        (address owner, uint256 ownerPk) = makeAddrAndKey("walletOwner");
        MockErc1271Wallet wallet = new MockErc1271Wallet(owner);
        _fund(address(wallet), 10 * AMOUNT);
        uint256 id = _directSub(address(wallet));
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(ownerPk, id, deadline);

        vm.prank(relayer);
        subs.cancelWithSig(id, deadline, sig);
        assertTrue(subs.getSubscription(id).cancelled);
    }

    function test_cancelSignatureFromSomeoneElseIsRefused() public {
        uint256 id = _directSub(payer);
        (, uint256 strangerPk) = makeAddrAndKey("stranger");
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(strangerPk, id, deadline);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidCancelSignature.selector);
        subs.cancelWithSig(id, deadline, sig);
    }

    function test_expiredCancelSignatureIsRefused() public {
        uint256 id = _directSub(payer);
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(payerPk, id, deadline);
        vm.warp(deadline + 1);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__CancelExpired.selector, deadline));
        subs.cancelWithSig(id, deadline, sig);
    }

    function test_cancelSignatureCannotBeReplayed() public {
        uint256 id = _directSub(payer);
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(payerPk, id, deadline);
        vm.prank(relayer);
        subs.cancelWithSig(id, deadline, sig);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__AlreadyCancelled.selector, id));
        subs.cancelWithSig(id, deadline, sig);
    }

    function test_cancelSignatureForAnotherSubscriptionIsRefused() public {
        uint256 first = _directSub(payer);
        uint256 second = _directSub(payer);
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(payerPk, first, deadline);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidCancelSignature.selector);
        subs.cancelWithSig(second, deadline, sig);
    }

    function test_cancelledSubscriptionIsNotCharged() public {
        uint256 id = _directSub(payer);
        uint256 deadline = block.timestamp + 30 minutes;
        bytes memory sig = _cancelSig(payerPk, id, deadline);
        vm.prank(relayer);
        subs.cancelWithSig(id, deadline, sig);

        bytes32 charger = subs.CHARGER_ROLE();
        vm.prank(admin);
        subs.grantRole(charger, relayer);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("after-cancel");
        uint256 before = usdc.balanceOf(payer);
        vm.prank(relayer);
        IStrimzSubscriptions.ChargeOutcome[] memory out = subs.batchCharge(ids, attempts);
        assertEq(uint8(out[0]), uint8(IStrimzSubscriptions.ChargeOutcome.Cancelled));
        assertEq(usdc.balanceOf(payer), before);
    }
}
