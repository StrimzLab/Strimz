// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Upgrades, Options } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistryV1 } from "./upgrades/StrimzRegistryV1.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../src/interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

interface IPausableAdmin {
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);
    function grantRole(bytes32 role, address account) external;
    function PAUSER_ROLE() external view returns (bytes32);
}

interface IRoleAdmins {
    function initializeRoleAdmins() external;
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
}

contract AdminRolesTest is StrimzTestBase {
    bytes32 internal constant PAUSER_ROLE = keccak256("STRIMZ_PAUSER_ROLE");
    bytes32 internal constant ADMIN_ROLE = keccak256("STRIMZ_ADMIN_ROLE");
    bytes32 internal constant CHARGER_ROLE = keccak256("STRIMZ_CHARGER_ROLE");
    bytes32 internal constant MERCHANT_REGISTRAR_ROLE = keccak256("STRIMZ_MERCHANT_REGISTRAR_ROLE");

    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzSubscriptions internal subs;
    StrimzAgentEscrow internal escrow;

    address internal operator;
    address internal guardian;

    function setUp() public {
        operator = makeAddr("operator");
        guardian = makeAddr("guardian");

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);
        escrow = _deployAgentEscrow(admin, whitelist);
    }

    function _pausables() internal view returns (IPausableAdmin[3] memory) {
        return [IPausableAdmin(address(payments)), IPausableAdmin(address(subs)), IPausableAdmin(address(escrow))];
    }

    function test_pauserRoleIsPausable() public view {
        IPausableAdmin[3] memory targets = _pausables();
        for (uint256 i; i < targets.length; ++i) {
            assertEq(targets[i].PAUSER_ROLE(), PAUSER_ROLE, "PAUSER_ROLE constant");
        }
    }

    function test_guardianWithOnlyPauserRoleCanPause() public {
        IPausableAdmin[3] memory targets = _pausables();
        for (uint256 i; i < targets.length; ++i) {
            vm.prank(admin);
            targets[i].grantRole(PAUSER_ROLE, guardian);
            vm.prank(guardian);
            targets[i].pause();
            assertTrue(targets[i].paused(), "guardian pauses");
        }
    }

    function test_guardianCannotUnpause() public {
        IPausableAdmin[3] memory targets = _pausables();
        for (uint256 i; i < targets.length; ++i) {
            vm.startPrank(admin);
            targets[i].grantRole(PAUSER_ROLE, guardian);
            targets[i].pause();
            vm.stopPrank();
            vm.expectRevert();
            vm.prank(guardian);
            targets[i].unpause();
        }
    }

    function test_operatorWithOnlyAdminRoleCannotPause() public {
        IPausableAdmin[3] memory targets = _pausables();
        for (uint256 i; i < targets.length; ++i) {
            vm.prank(admin);
            targets[i].grantRole(ADMIN_ROLE, operator);
            vm.expectRevert();
            vm.prank(operator);
            targets[i].pause();
        }
    }

    function test_operatorWithOnlyAdminRoleCannotRotatePaymentsDependencies() public {
        vm.startPrank(admin);
        payments.grantRole(ADMIN_ROLE, operator);
        payments.pause();
        vm.stopPrank();

        address other = makeAddr("other");
        vm.startPrank(operator);
        vm.expectRevert();
        payments.setRegistry(IStrimzRegistry(other));
        vm.expectRevert();
        payments.setFeeCollector(IFeeCollector(other));
        vm.expectRevert();
        payments.setTokenWhitelist(ITokenWhitelist(other));
        vm.stopPrank();
    }

    function test_operatorWithOnlyAdminRoleCannotRotateSubscriptionsDependencies() public {
        vm.startPrank(admin);
        subs.grantRole(ADMIN_ROLE, operator);
        subs.pause();
        vm.stopPrank();

        address other = makeAddr("other");
        vm.startPrank(operator);
        vm.expectRevert();
        subs.setRegistry(IStrimzRegistry(other));
        vm.expectRevert();
        subs.setFeeCollector(IFeeCollector(other));
        vm.expectRevert();
        subs.setTokenWhitelist(ITokenWhitelist(other));
        vm.stopPrank();
    }

    function test_operatorWithOnlyAdminRoleCannotRotateEscrowWhitelist() public {
        vm.prank(admin);
        escrow.grantRole(ADMIN_ROLE, operator);
        vm.expectRevert();
        vm.prank(operator);
        escrow.setTokenWhitelist(ITokenWhitelist(makeAddr("other")));
    }

    function test_defaultAdminRotatesWhilePaused() public {
        address newRegistry = address(_deployRegistry(admin));
        vm.startPrank(admin);
        payments.pause();
        payments.setRegistry(IStrimzRegistry(newRegistry));
        subs.pause();
        subs.setRegistry(IStrimzRegistry(newRegistry));
        vm.stopPrank();
        assertEq(address(payments.registry()), newRegistry);
        assertEq(address(subs.registry()), newRegistry);
    }

    function test_subscriptionsChargerAdministeredByAdmin() public view {
        assertEq(IRoleAdmins(address(subs)).getRoleAdmin(CHARGER_ROLE), ADMIN_ROLE);
    }

    function test_registryInitializeRoleAdminsOnce() public {
        vm.prank(admin);
        IRoleAdmins(address(registry)).initializeRoleAdmins();
        assertEq(IRoleAdmins(address(registry)).getRoleAdmin(MERCHANT_REGISTRAR_ROLE), ADMIN_ROLE);

        vm.expectRevert();
        vm.prank(admin);
        IRoleAdmins(address(registry)).initializeRoleAdmins();
    }

    function test_registryInitializeRoleAdminsRequiresDefaultAdmin() public {
        vm.prank(admin);
        registry.grantRole(ADMIN_ROLE, operator);
        vm.expectRevert();
        vm.prank(operator);
        IRoleAdmins(address(registry)).initializeRoleAdmins();
    }

    function test_registryUpgradeSetsRoleAdmins() public {
        Options memory v1;
        v1.unsafeAllow = "constructor";
        address proxy = Upgrades.deployUUPSProxy(
            "StrimzRegistryV1.sol:StrimzRegistryV1", abi.encodeCall(StrimzRegistryV1.initialize, (admin)), v1
        );

        Options memory opts;
        opts.referenceContract = "StrimzRegistryV1.sol:StrimzRegistryV1";
        vm.startPrank(admin);
        Upgrades.upgradeProxy(
            proxy, "StrimzRegistry.sol:StrimzRegistry", abi.encodeWithSignature("initializeRoleAdmins()"), opts
        );
        vm.stopPrank();

        assertEq(IRoleAdmins(proxy).getRoleAdmin(MERCHANT_REGISTRAR_ROLE), ADMIN_ROLE);
    }
}
