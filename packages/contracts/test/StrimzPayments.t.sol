// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";

contract StrimzPaymentsTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    uint256 internal merchantId;

    function setUp() public {
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(payments)
        );
        merchantId = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        vm.stopPrank();

        _fund(payer, 1_000_000_000);
        vm.prank(payer);
        usdc.approve(address(payments), type(uint256).max);
    }

    function test_paySplitsFeeAndNet() public {
        uint256 amount = 100_000_000;
        uint256 expectedFee = (amount * 150) / 10_000;
        uint256 expectedNet = amount - expectedFee;

        vm.prank(payer);
        payments.pay(merchantId, address(usdc), amount, keccak256("session-1"));

        assertEq(usdc.balanceOf(merchantPayout), expectedNet, "merchant net");
        assertEq(usdc.balanceOf(address(feeCollector)), expectedFee, "collector fee");
        assertEq(feeCollector.totalAccrued(address(usdc)), expectedFee, "accrued");
    }

    function test_rejectsUnwhitelistedToken() public {
        vm.prank(admin);
        whitelist.remove(address(usdc));

        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzPayments.Payments__InvalidToken.selector, address(usdc))
        );
        payments.pay(merchantId, address(usdc), 1_000_000, bytes32(0));
    }

    function test_rejectsZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidAmount.selector);
        payments.pay(merchantId, address(usdc), 0, bytes32(0));
    }

    function test_pausedBlocksPayment() public {
        vm.prank(admin);
        payments.pause();

        vm.prank(payer);
        vm.expectRevert();
        payments.pay(merchantId, address(usdc), 1_000_000, bytes32(0));
    }
}
