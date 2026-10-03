// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IStrimzAgentRegistry } from "../src/interfaces/IStrimzAgentRegistry.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Vm } from "forge-std/Vm.sol";

contract ContractPermissionGapsTest is StrimzTestBase {
    StrimzRegistry internal registry;
    StrimzAgentRegistry internal agents;
    uint256 internal merchantId;
    address internal attacker;

    uint16 internal constant FEE_BPS = 100;

    function setUp() public {
        attacker = makeAddr("attacker");

        registry = _deployRegistry(admin);
        agents = _deployAgentRegistry(admin);

        vm.prank(admin);
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
    }

    function test_ownershipAcceptanceCannotSkipTheDelay() public {
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, attacker);

        vm.expectRevert();
        vm.prank(attacker);
        registry.acceptMerchantOwnership(merchantId);

        assertEq(registry.getMerchant(merchantId).owner, merchant, "owner must keep control during the delay");
    }

    function test_acceptingOwnershipCancelsPendingPayoutChange() public {
        address previousOwnerPick = makeAddr("previousOwnerPick");
        address newOwner = makeAddr("newOwner");

        vm.startPrank(merchant);
        registry.setPayoutAddress(merchantId, previousOwnerPick);
        registry.transferMerchantOwnership(merchantId, newOwner);
        vm.stopPrank();

        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY() + 1);
        vm.prank(newOwner);
        registry.acceptMerchantOwnership(merchantId);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(merchantId);
        assertEq(m.pendingPayoutAddress, address(0), "pending payout change must not survive acceptance");
        assertEq(m.payoutChangeCommitAt, 0, "commit time must be cleared on acceptance");

        vm.expectRevert(IStrimzRegistry.Registry__NoPendingPayoutChange.selector);
        registry.commitPayoutAddress(merchantId);
        assertEq(registry.getMerchant(merchantId).payoutAddress, merchantPayout, "payout stays where it was");
    }

    function test_controllerCannotReactivateAfterAdminDeactivation() public {
        address agent = makeAddr("agent");
        vm.prank(agent);
        agents.registerAgent(agent, bytes32(uint256(1)), "agent", "1.0.0");

        vm.prank(admin);
        agents.deactivate(agent);

        vm.expectRevert();
        vm.prank(agent);
        agents.activate(agent);

        assertFalse(agents.isActive(agent), "admin deactivation must stick");
    }

    function test_acceptanceBecomesPossibleExactlyAfterTheDelay() public {
        address next = makeAddr("next");
        uint64 acceptableAt = uint64(block.timestamp) + registry.PAYOUT_CHANGE_DELAY();

        vm.expectEmit(true, true, true, true, address(registry));
        emit IStrimzRegistry.MerchantOwnershipTransferInitiated(merchantId, merchant, next);
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, next);
        assertEq(registry.pendingOwnerAcceptableAt(merchantId), acceptableAt);

        vm.warp(acceptableAt - 1);
        vm.expectRevert(IStrimzRegistry.Registry__OwnershipTransferNotDue.selector);
        vm.prank(next);
        registry.acceptMerchantOwnership(merchantId);

        vm.warp(acceptableAt);
        vm.expectEmit(true, true, true, true, address(registry));
        emit IStrimzRegistry.MerchantOwnershipTransferAccepted(merchantId, merchant, next);
        vm.prank(next);
        registry.acceptMerchantOwnership(merchantId);

        assertEq(registry.getMerchant(merchantId).owner, next);
        assertEq(registry.pendingOwnerOf(merchantId), address(0));
        assertEq(registry.pendingOwnerAcceptableAt(merchantId), 0);
    }

    function test_renominationRestartsTheDelay() public {
        address first = makeAddr("first");
        address second = makeAddr("second");
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, first);

        vm.warp(block.timestamp + 12 hours);
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, second);
        uint64 acceptableAt = uint64(block.timestamp) + registry.PAYOUT_CHANGE_DELAY();
        assertEq(registry.pendingOwnerAcceptableAt(merchantId), acceptableAt);

        vm.warp(acceptableAt - 1);
        vm.expectRevert(IStrimzRegistry.Registry__OwnershipTransferNotDue.selector);
        vm.prank(second);
        registry.acceptMerchantOwnership(merchantId);
    }

    function test_ownerCancelClearsAcceptableAt() public {
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, attacker);

        vm.prank(merchant);
        registry.cancelOwnershipTransfer(merchantId);

        assertEq(registry.pendingOwnerAcceptableAt(merchantId), 0);
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY());
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingTransfer.selector);
        vm.prank(attacker);
        registry.acceptMerchantOwnership(merchantId);
    }

    function test_pendingOwnerAcceptableAtRevertsForUnknownMerchant() public {
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__UnknownMerchant.selector, 999));
        registry.pendingOwnerAcceptableAt(999);
    }

    function test_acceptanceWithoutPendingPayoutChangeEmitsNoCancellation() public {
        address next = makeAddr("next");
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, next);
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY());

        vm.recordLogs();
        vm.prank(next);
        registry.acceptMerchantOwnership(merchantId);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], IStrimzRegistry.MerchantOwnershipTransferAccepted.selector);
    }

    function test_acceptanceEmitsPayoutCancellationBeforeAcceptance() public {
        address next = makeAddr("next");
        vm.startPrank(merchant);
        registry.setPayoutAddress(merchantId, makeAddr("previousOwnerPick"));
        registry.transferMerchantOwnership(merchantId, next);
        vm.stopPrank();
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY());

        vm.recordLogs();
        vm.prank(next);
        registry.acceptMerchantOwnership(merchantId);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2);
        assertEq(logs[0].topics[0], IStrimzRegistry.MerchantPayoutChangeCancelled.selector);
        assertEq(logs[0].topics[1], bytes32(merchantId));
        assertEq(logs[1].topics[0], IStrimzRegistry.MerchantOwnershipTransferAccepted.selector);
    }

    function test_adminCancelsPendingPayoutChange() public {
        vm.prank(merchant);
        registry.setPayoutAddress(merchantId, attacker);

        vm.expectEmit(true, true, true, true, address(registry));
        emit IStrimzRegistry.MerchantPayoutChangeCancelled(merchantId);
        vm.prank(admin);
        registry.adminCancelPayoutChange(merchantId);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(merchantId);
        assertEq(m.pendingPayoutAddress, address(0));
        assertEq(m.payoutChangeCommitAt, 0);
        assertEq(m.payoutAddress, merchantPayout);
        assertEq(m.owner, merchant);
    }

    function test_adminCancelPayoutChangeIsAdminOnly() public {
        vm.prank(merchant);
        registry.setPayoutAddress(merchantId, attacker);
        bytes32 role = registry.ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, merchant, role)
        );
        vm.prank(merchant);
        registry.adminCancelPayoutChange(merchantId);

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role)
        );
        vm.prank(attacker);
        registry.adminCancelPayoutChange(merchantId);

        assertEq(registry.getMerchant(merchantId).pendingPayoutAddress, attacker);
    }

    function test_adminCancelPayoutChangeRevertsWithoutPendingChange() public {
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingPayoutChange.selector);
        vm.prank(admin);
        registry.adminCancelPayoutChange(merchantId);
    }

    function test_adminCancelPayoutChangeRevertsForUnknownMerchant() public {
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__UnknownMerchant.selector, 999));
        vm.prank(admin);
        registry.adminCancelPayoutChange(999);
    }

    function test_adminCancelsPendingOwnershipTransfer() public {
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, attacker);

        vm.expectEmit(true, true, true, true, address(registry));
        emit IStrimzRegistry.MerchantOwnershipTransferCancelled(merchantId);
        vm.prank(admin);
        registry.adminCancelOwnershipTransfer(merchantId);

        assertEq(registry.pendingOwnerOf(merchantId), address(0));
        assertEq(registry.pendingOwnerAcceptableAt(merchantId), 0);
        assertEq(registry.getMerchant(merchantId).owner, merchant);

        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY());
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingTransfer.selector);
        vm.prank(attacker);
        registry.acceptMerchantOwnership(merchantId);
    }

    function test_adminCancelOwnershipTransferIsAdminOnly() public {
        vm.prank(merchant);
        registry.transferMerchantOwnership(merchantId, attacker);
        bytes32 role = registry.ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, merchant, role)
        );
        vm.prank(merchant);
        registry.adminCancelOwnershipTransfer(merchantId);

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role)
        );
        vm.prank(attacker);
        registry.adminCancelOwnershipTransfer(merchantId);

        assertEq(registry.pendingOwnerOf(merchantId), attacker);
    }

    function test_adminCancelOwnershipTransferRevertsWithoutPendingTransfer() public {
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingTransfer.selector);
        vm.prank(admin);
        registry.adminCancelOwnershipTransfer(merchantId);
    }

    function test_adminCancelOwnershipTransferRevertsForUnknownMerchant() public {
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__UnknownMerchant.selector, 999));
        vm.prank(admin);
        registry.adminCancelOwnershipTransfer(999);
    }

    function test_adminDeactivationSuspendsAgent() public {
        address agent = _registerAgent();

        vm.expectEmit(true, true, true, true, address(agents));
        emit IStrimzAgentRegistry.AgentDeactivated(agent);
        vm.prank(admin);
        agents.deactivate(agent);

        assertTrue(agents.isSuspended(agent));
        assertFalse(agents.isActive(agent));

        vm.expectRevert(abi.encodeWithSelector(IStrimzAgentRegistry.AgentRegistry__Suspended.selector, agent));
        vm.prank(agent);
        agents.activate(agent);
    }

    function test_controllerDeactivationDoesNotSuspend() public {
        address agent = _registerAgent();

        vm.prank(agent);
        agents.deactivate(agent);
        assertFalse(agents.isSuspended(agent));
        assertFalse(agents.isActive(agent));

        vm.expectEmit(true, true, true, true, address(agents));
        emit IStrimzAgentRegistry.AgentActivated(agent);
        vm.prank(agent);
        agents.activate(agent);
        assertTrue(agents.isActive(agent));
    }

    function test_controllerDeactivationKeepsAdminSuspension() public {
        address agent = _registerAgent();
        vm.prank(admin);
        agents.deactivate(agent);

        vm.prank(agent);
        agents.deactivate(agent);

        assertTrue(agents.isSuspended(agent));
        vm.expectRevert(abi.encodeWithSelector(IStrimzAgentRegistry.AgentRegistry__Suspended.selector, agent));
        vm.prank(agent);
        agents.activate(agent);
    }

    function test_adminActivationClearsSuspension() public {
        address agent = _registerAgent();
        vm.prank(admin);
        agents.deactivate(agent);

        vm.expectEmit(true, true, true, true, address(agents));
        emit IStrimzAgentRegistry.AgentActivated(agent);
        vm.prank(admin);
        agents.activate(agent);

        assertFalse(agents.isSuspended(agent));
        assertTrue(agents.isActive(agent));

        vm.prank(agent);
        agents.deactivate(agent);
        vm.prank(agent);
        agents.activate(agent);
        assertTrue(agents.isActive(agent));
    }

    function test_strangerCannotActivateAgent() public {
        address agent = _registerAgent();
        vm.prank(agent);
        agents.deactivate(agent);

        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__NotController.selector);
        vm.prank(attacker);
        agents.activate(agent);
    }

    function test_isSuspendedIsFalseForUnknownAgent() public {
        assertFalse(agents.isSuspended(makeAddr("unknown")));
    }

    function _registerAgent() internal returns (address agent) {
        agent = makeAddr("agent");
        vm.prank(agent);
        agents.registerAgent(agent, bytes32(uint256(1)), "agent", "1.0.0");
    }
}
