// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../src/interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

contract ContractHygieneTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzAgentEscrow internal escrow;

    function setUp() public {
        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);
        escrow = _deployAgentEscrow(admin, whitelist);
    }

    function test_paymentsSettersRejectZeroAddressAsZeroAddress() public {
        vm.startPrank(admin);
        payments.pause();
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        payments.setRegistry(IStrimzRegistry(address(0)));
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        payments.setFeeCollector(IFeeCollector(address(0)));
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        payments.setTokenWhitelist(ITokenWhitelist(address(0)));
        vm.stopPrank();
    }

    function test_paymentsConstructorRejectsZeroAdmin() public {
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        new StrimzPayments(address(0), registry, feeCollector, whitelist);
    }

    function test_paymentsConstructorRejectsZeroRegistry() public {
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        new StrimzPayments(admin, IStrimzRegistry(address(0)), feeCollector, whitelist);
    }

    function test_paymentsConstructorRejectsZeroFeeCollector() public {
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        new StrimzPayments(admin, registry, IFeeCollector(address(0)), whitelist);
    }

    function test_paymentsConstructorRejectsZeroWhitelist() public {
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        new StrimzPayments(admin, registry, feeCollector, ITokenWhitelist(address(0)));
    }

    function test_escrowWhitelistCannotChangeWhileLive() public {
        address other = makeAddr("otherWhitelist");
        vm.prank(admin);
        vm.expectRevert(PausableUpgradeable.ExpectedPause.selector);
        escrow.setTokenWhitelist(ITokenWhitelist(other));
        assertEq(address(escrow.tokenWhitelist()), address(whitelist));
    }

    function test_escrowWhitelistChangesWhilePaused() public {
        address other = makeAddr("otherWhitelist");
        vm.startPrank(admin);
        escrow.pause();
        escrow.setTokenWhitelist(ITokenWhitelist(other));
        escrow.unpause();
        vm.stopPrank();
        assertEq(address(escrow.tokenWhitelist()), other);
    }

    function test_freshRegistryHasServiceRoleAdminsSet() public view {
        bytes32 adminRole = registry.ADMIN_ROLE();
        assertEq(registry.getRoleAdmin(registry.MERCHANT_REGISTRAR_ROLE()), adminRole);
        assertEq(registry.getRoleAdmin(registry.FEE_MANAGER_ROLE()), adminRole);
    }
}
