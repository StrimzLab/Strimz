// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, StdInvariant } from "forge-std/Test.sol";
import { StrimzTestBase, MockUsdc } from "../Helpers.t.sol";
import { StrimzRegistry } from "../../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../../src/interfaces/IStrimzSubscriptions.sol";

contract SubscriptionsHandler is Test {
    StrimzSubscriptions public immutable SUBS;
    MockUsdc public immutable USDC;
    uint256 public immutable MERCHANT_ID;
    uint16 public immutable FEE_BPS;

    address[3] internal payers;
    uint256[] internal subIds;
    uint256 internal attemptCounter;

    uint256 public ghostFees;
    uint256 public ghostNet;

    constructor(StrimzSubscriptions subs, MockUsdc usdc, uint256 merchantId, uint16 feeBps) {
        SUBS = subs;
        USDC = usdc;
        MERCHANT_ID = merchantId;
        FEE_BPS = feeBps;
        for (uint256 i; i < payers.length; i++) {
            payers[i] = makeAddr(string.concat("invariant.subscriber.", vm.toString(i)));
            USDC.mint(payers[i], 1_000_000_000_000);
            vm.prank(payers[i]);
            USDC.approve(address(SUBS), type(uint256).max);
        }
    }

    function create(uint8 payerIdx, uint64 amountIn, uint32 intervalIn) external {
        if (subIds.length >= 30) return;
        uint256 amount = (uint256(amountIn) % 10_000_000_000) + 1;
        uint32 interval = uint32(bound(intervalIn, 1 hours, 30 days));
        vm.prank(payers[payerIdx % payers.length]);
        subIds.push(SUBS.createSubscription(MERCHANT_ID, address(USDC), amount, interval, 0, 0));
    }

    function charge(uint8 count) external {
        uint256 n = subIds.length;
        if (n == 0) return;
        n = (uint256(count) % n) + 1;
        uint256[] memory ids = new uint256[](n);
        bytes32[] memory attempts = new bytes32[](n);
        for (uint256 i; i < n; i++) {
            ids[i] = subIds[i];
            attempts[i] = keccak256(abi.encode(++attemptCounter));
        }
        IStrimzSubscriptions.ChargeOutcome[] memory out = SUBS.batchCharge(ids, attempts);
        for (uint256 i; i < n; i++) {
            if (out[i] != IStrimzSubscriptions.ChargeOutcome.Charged) continue;
            uint256 amount = SUBS.getSubscription(ids[i]).amount;
            uint256 fee = amount * FEE_BPS / 10_000;
            ghostFees += fee;
            ghostNet += amount - fee;
        }
    }

    function cancel(uint8 idx) external {
        if (subIds.length == 0) return;
        uint256 id = subIds[idx % subIds.length];
        IStrimzSubscriptions.Subscription memory sub = SUBS.getSubscription(id);
        if (sub.cancelled) return;
        vm.prank(sub.payer);
        SUBS.cancel(id);
    }

    function operatorCancel(uint8 idx) external {
        if (subIds.length == 0) return;
        uint256 id = subIds[idx % subIds.length];
        if (SUBS.getSubscription(id).cancelled) return;
        SUBS.cancel(id);
    }

    function reinstate(uint8 idx) external {
        if (subIds.length == 0) return;
        uint256 id = subIds[idx % subIds.length];
        uint64 at = SUBS.operatorCancelledAt(id);
        if (at == 0 || block.timestamp > at + SUBS.REINSTATE_WINDOW()) return;
        SUBS.reinstate(id);
    }

    function warp(uint32 secondsIn) external {
        vm.warp(block.timestamp + bound(secondsIn, 1, 60 days));
    }
}

/// Subscriptions moves charges straight from the payer to FeeCollector and the
/// merchant, so it should never hold a balance. `rescue` relies on that.
contract SubscriptionsInvariantsTest is StdInvariant, StrimzTestBase {
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    SubscriptionsHandler internal handler;
    uint16 internal constant FEE_BPS = 150;

    function setUp() public {
        _setUpTokens();
        StrimzRegistry registry = _deployRegistry(admin);
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(subs));
        uint256 mid = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, FEE_BPS, 0);
        vm.stopPrank();

        handler = new SubscriptionsHandler(subs, usdc, mid, FEE_BPS);
        bytes32 charger = subs.CHARGER_ROLE();
        bytes32 cancellerRole = subs.SUBSCRIPTION_CANCELLER_ROLE();
        bytes32 adminRole = subs.ADMIN_ROLE();
        vm.startPrank(admin);
        subs.grantRole(charger, address(handler));
        subs.grantRole(cancellerRole, address(handler));
        subs.grantRole(adminRole, address(handler));
        vm.stopPrank();
        targetContract(address(handler));
    }

    function invariant_subscriptionsHoldsNoBalance() public view {
        assertEq(usdc.balanceOf(address(subs)), 0);
    }

    function invariant_merchantReceivesExactlyTheNetCharged() public view {
        assertEq(usdc.balanceOf(merchantPayout), handler.ghostNet());
    }

    function invariant_feeCollectorReceivesExactlyTheFeesCharged() public view {
        assertEq(usdc.balanceOf(address(feeCollector)), handler.ghostFees());
        assertEq(feeCollector.totalAccrued(address(usdc)), handler.ghostFees());
    }
}
