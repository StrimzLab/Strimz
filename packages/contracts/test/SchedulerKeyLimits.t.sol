// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

contract SchedulerKeyLimitsTest is StrimzTestBase {
    uint256 internal constant AMOUNT = 10_000_000;
    uint32 internal constant INTERVAL = 30 days;

    StrimzRegistry internal registry;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    address internal scheduler;
    uint256 internal merchantId;

    function setUp() public {
        _setUpTokens();
        registry = _deployRegistry(admin);
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);
        scheduler = makeAddr("scheduler");

        bytes32 accruer = feeCollector.FEE_ACCRUER_ROLE();
        bytes32 charger = subs.CHARGER_ROLE();
        bytes32 cancellerRole = subs.SUBSCRIPTION_CANCELLER_ROLE();
        bytes32 feeManager = registry.FEE_MANAGER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(accruer, address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, 0, 50, 0);
        subs.grantRole(charger, scheduler);
        subs.grantRole(cancellerRole, _canceller());
        registry.grantRole(feeManager, scheduler);
        vm.stopPrank();

        _fund(payer, 100 * AMOUNT);
        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
    }

    function test_chargerAloneCannotCancel() public {
        uint256 id = _subscribe();
        vm.prank(scheduler);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__NotSubscriptionParty.selector);
        subs.cancel(id);
        assertFalse(subs.getSubscription(id).cancelled);
    }

    function test_feeManagerIncreaseDoesNotApplyAtOnce() public {
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 50);
        assertEq(registry.getMerchant(merchantId).feeBps, 0);
    }

    function test_feeManagerDecreaseAppliesAtOnce() public {
        vm.prank(admin);
        registry.setFeeBps(merchantId, 50);
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 40);
        assertEq(registry.getMerchant(merchantId).feeBps, 40);
    }

    function test_adminIncreaseAppliesAtOnce() public {
        vm.prank(admin);
        registry.setFeeBps(merchantId, 50);
        assertEq(registry.getMerchant(merchantId).feeBps, 50);
    }

    // ---------- Operator cancels ----------

    function test_operatorCancelIsRecordedAndReinstatable() public {
        uint256 id = _subscribe();
        vm.prank(_canceller());
        subs.cancel(id);
        assertTrue(subs.getSubscription(id).cancelled);
        assertEq(subs.operatorCancelledAt(id), uint64(block.timestamp));

        vm.expectEmit(true, true, false, false, address(subs));
        emit IStrimzSubscriptions.SubscriptionReinstated(id, admin);
        vm.prank(admin);
        subs.reinstate(id);
        assertFalse(subs.getSubscription(id).cancelled);
        assertEq(subs.operatorCancelledAt(id), 0);
    }

    function test_reinstatedSubscriptionIsChargedOnceForTheGap() public {
        vm.prank(payer);
        uint256 id = subs.createSubscription(merchantId, address(usdc), AMOUNT, 1 days, 0, 0);
        _charge(id, "first day");
        vm.prank(_canceller());
        subs.cancel(id);
        vm.warp(block.timestamp + 6 days);
        vm.prank(admin);
        subs.reinstate(id);

        uint256 before = usdc.balanceOf(payer);
        _charge(id, "after reinstate");
        assertEq(before - usdc.balanceOf(payer), AMOUNT);
        _charge(id, "same period again");
        assertEq(before - usdc.balanceOf(payer), AMOUNT);
    }

    function test_payerAndOwnerCancelsAreFinal() public {
        uint256 byPayer = _subscribe();
        vm.prank(payer);
        subs.cancel(byPayer);
        uint256 byOwner = _subscribe();
        vm.prank(merchant);
        subs.cancel(byOwner);

        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, byPayer));
        subs.reinstate(byPayer);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, byOwner));
        subs.reinstate(byOwner);
        vm.stopPrank();
    }

    function test_reinstateRefusesLiveOrUnknownSubscriptions() public {
        uint256 id = _subscribe();
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, id));
        subs.reinstate(id);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__NotReinstatable.selector, 999));
        subs.reinstate(999);
        vm.stopPrank();
    }

    function test_reinstateWindowCloses() public {
        uint256 id = _subscribe();
        vm.prank(_canceller());
        subs.cancel(id);
        vm.warp(block.timestamp + subs.REINSTATE_WINDOW() + 1);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__ReinstateWindowClosed.selector, id));
        subs.reinstate(id);
    }

    function test_onlyAdminCanReinstate() public {
        uint256 id = _subscribe();
        vm.prank(_canceller());
        subs.cancel(id);
        vm.prank(_canceller());
        vm.expectRevert();
        subs.reinstate(id);
        vm.prank(scheduler);
        vm.expectRevert();
        subs.reinstate(id);
    }

    function test_reinstateWorksWhilePaused() public {
        uint256 id = _subscribe();
        vm.prank(_canceller());
        subs.cancel(id);
        vm.startPrank(admin);
        subs.pause();
        subs.reinstate(id);
        vm.stopPrank();
        assertFalse(subs.getSubscription(id).cancelled);
    }

    // ---------- Delayed fee increases ----------

    function test_feeManagerIncreaseCommitsAfterDelay() public {
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 50);
        (uint16 pendingBps, uint64 effectiveAt) = registry.pendingFeeOf(merchantId);
        assertEq(pendingBps, 50);
        assertEq(effectiveAt, uint64(block.timestamp) + registry.FEE_INCREASE_DELAY());

        vm.expectRevert(IStrimzRegistry.Registry__FeeChangeNotDue.selector);
        registry.commitFeeBps(merchantId);

        vm.warp(effectiveAt);
        vm.prank(makeAddr("anyone"));
        registry.commitFeeBps(merchantId);
        assertEq(registry.getMerchant(merchantId).feeBps, 50);
        (, effectiveAt) = registry.pendingFeeOf(merchantId);
        assertEq(effectiveAt, 0);

        vm.expectRevert(IStrimzRegistry.Registry__NoPendingFeeChange.selector);
        registry.commitFeeBps(merchantId);
    }

    function test_adminCancelsAPendingIncrease() public {
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 50);
        vm.prank(scheduler);
        vm.expectRevert();
        registry.cancelFeeIncrease(merchantId);

        vm.prank(admin);
        registry.cancelFeeIncrease(merchantId);
        vm.warp(block.timestamp + registry.FEE_INCREASE_DELAY());
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingFeeChange.selector);
        registry.commitFeeBps(merchantId);
        assertEq(registry.getMerchant(merchantId).feeBps, 0);
    }

    function test_directFeeChangeClearsPendingIncrease() public {
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 50);
        vm.prank(admin);
        registry.setFeeBps(merchantId, 40);
        (, uint64 effectiveAt) = registry.pendingFeeOf(merchantId);
        assertEq(effectiveAt, 0);
        assertEq(registry.getMerchant(merchantId).feeBps, 40);
    }

    function test_feeManagerIncreaseStillRespectsCeiling() public {
        vm.prank(scheduler);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__FeeExceedsMax.selector, 60, 50));
        registry.setFeeBps(merchantId, 60);
    }

    function test_chargesUseTheCommittedFeeWhileIncreaseIsPending() public {
        vm.prank(scheduler);
        registry.setFeeBps(merchantId, 50);
        uint256 id = _subscribe();
        _charge(id, "pending");
        assertEq(usdc.balanceOf(address(feeCollector)), 0);
        assertEq(usdc.balanceOf(merchantPayout), AMOUNT);
    }

    function _canceller() internal returns (address) {
        return makeAddr("cancellerOnly");
    }

    function _charge(uint256 id, string memory tag) internal {
        uint256[] memory ids = new uint256[](1);
        bytes32[] memory attempts = new bytes32[](1);
        ids[0] = id;
        attempts[0] = keccak256(bytes(tag));
        vm.prank(scheduler);
        subs.batchCharge(ids, attempts);
    }

    function _subscribe() internal returns (uint256 id) {
        vm.prank(payer);
        id = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
    }
}
