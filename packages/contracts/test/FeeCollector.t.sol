// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IFeeCollector } from "../src/interfaces/IFeeCollector.sol";

contract FeeCollectorTest is StrimzTestBase {
    FeeCollector internal feeCollector;

    function setUp() public {
        _setUpTokens();
        feeCollector = _deployFeeCollector(admin);
    }

    function test_onlyAccruerCanAccrue() public {
        vm.prank(payer);
        vm.expectRevert();
        feeCollector.accrue(address(usdc), 1, 100);
    }

    function test_withdrawSendsFundsToRecipient() public {
        usdc.mint(address(feeCollector), 1_000_000);
        bytes32 accruerRole = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();

        vm.startPrank(admin);
        feeCollector.grantRole(accruerRole, admin);
        feeCollector.accrue(address(usdc), 1, 1_000_000);
        feeCollector.withdraw(address(usdc), treasury, 500_000);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 500_000);
        assertEq(feeCollector.balanceOf(address(usdc)), 500_000);
    }

    function test_rejectsWithdrawOverBalance() public {
        vm.prank(admin);
        vm.expectRevert(IFeeCollector.FeeCollector__InsufficientBalance.selector);
        feeCollector.withdraw(address(usdc), treasury, 1);
    }
}
