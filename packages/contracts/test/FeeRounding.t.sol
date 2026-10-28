// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

/// Fees round down on purpose (#382): Strimz never takes more than the
/// merchant's rate or their on-chain maximum.
contract FeeRoundingTest is StrimzTestBase {
    StrimzRegistry internal registry;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzSubscriptions internal subs;

    uint256 internal constant MAX_AMOUNT = 1e15;

    function setUp() public {
        _setUpTokens();
        registry = _deployRegistry(admin);
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        bytes32 accruer = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(accruer, address(payments));
        feeCollector.grantRole(accruer, address(subs));
        vm.stopPrank();

        _fund(payer, MAX_AMOUNT);
        vm.startPrank(payer);
        usdc.approve(address(payments), type(uint256).max);
        usdc.approve(address(subs), type(uint256).max);
        vm.stopPrank();
    }

    function _merchant(uint16 feeBps, uint16 maxFeeBps) internal returns (uint256 id) {
        vm.prank(admin);
        id = registry.registerMerchant(merchant, merchantPayout, feeBps, maxFeeBps, 0);
    }

    function _assertSplit(uint256 amount, uint16 feeBps, uint16 maxFeeBps) internal view {
        uint256 fee = usdc.balanceOf(address(feeCollector));
        uint256 net = usdc.balanceOf(merchantPayout);
        assertEq(fee, amount * feeBps / 10_000, "fee rounds down");
        assertLe(fee, amount * maxFeeBps / 10_000, "never above the merchant's maximum");
        assertEq(fee + net, amount, "nothing lost or created");
    }

    function testFuzz_payFeeRoundsDown(uint256 amount, uint16 feeBps, uint16 maxFeeBps) public {
        amount = bound(amount, 1, MAX_AMOUNT);
        maxFeeBps = uint16(bound(maxFeeBps, 0, registry.MAX_FEE_BPS()));
        feeBps = uint16(bound(feeBps, 0, maxFeeBps));
        uint256 id = _merchant(feeBps, maxFeeBps);

        vm.prank(payer);
        payments.pay(id, address(usdc), amount, keccak256("ref"));

        _assertSplit(amount, feeBps, maxFeeBps);
    }

    function testFuzz_chargeFeeRoundsDown(uint256 amount, uint16 feeBps, uint16 maxFeeBps) public {
        amount = bound(amount, 1, MAX_AMOUNT);
        maxFeeBps = uint16(bound(maxFeeBps, 0, registry.MAX_FEE_BPS()));
        feeBps = uint16(bound(feeBps, 0, maxFeeBps));
        uint256 id = _merchant(feeBps, maxFeeBps);

        vm.prank(payer);
        uint256 subId = subs.createSubscription(id, address(usdc), amount, 1 hours, 0, 0);
        uint256[] memory ids = new uint256[](1);
        ids[0] = subId;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome out = subs.batchCharge(ids, attempts)[0];

        assertEq(uint8(out), uint8(IStrimzSubscriptions.ChargeOutcome.Charged));
        _assertSplit(amount, feeBps, maxFeeBps);
    }

    function test_paymentTooSmallForAFeeCarriesNone() public {
        uint256 id = _merchant(50, 50);
        vm.prank(payer);
        payments.pay(id, address(usdc), 199, keccak256("ref"));
        assertEq(usdc.balanceOf(address(feeCollector)), 0);
        assertEq(usdc.balanceOf(merchantPayout), 199);
    }

    function test_smallestApiPaymentCarriesTheFullFee() public {
        uint256 id = _merchant(50, 50);
        vm.prank(payer);
        payments.pay(id, address(usdc), 1_000_000, keccak256("ref"));
        assertEq(usdc.balanceOf(address(feeCollector)), 5_000);
    }
}
