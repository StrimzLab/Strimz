// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzAgentRegistry.t
/// @notice Agent identity + reputation registry. If someone can grab
///         another wallet's identity slot, they can rotate its
///         credential and destroy its reputation. The self-register
///         rule is the whole security posture.
///
///         What we prove:
///           1. Agents self-register — msg.sender must equal the agent.
///              No squatting on someone else's address.
///           2. Zero address rejected.
///           3. Double-registration rejected.
///           4. Controller can rotate credential, deactivate, and
///              reactivate. Anyone else cannot.
///           5. Reputation adjustments require AGENT_ADMIN_ROLE and
///              sum correctly (positive + negative deltas).
///           6. isActive returns false for unknown and deactivated.

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { IStrimzAgentRegistry } from "../src/interfaces/IStrimzAgentRegistry.sol";

contract StrimzAgentRegistryTest is StrimzTestBase {
    StrimzAgentRegistry internal reg;

    function setUp() public {
        reg = _deployAgentRegistry(admin);
    }

    // ---------- Self-registration only ----------

    // An agent self-registers. Their own address is msg.sender and
    // the `agent` argument.
    function test_selfRegistrationWorks() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "Strimz AutoPay", "1.0.0");

        IStrimzAgentRegistry.Agent memory a = reg.getAgent(alice);
        assertEq(a.controller, alice, "self is controller");
        assertEq(a.name, "Strimz AutoPay");
        assertTrue(a.active);
        assertTrue(reg.isActive(alice));
    }

    // Someone else registering my address must fail. Without this,
    // any wallet could be squatted the moment its address is known.
    function test_cannotRegisterAnotherAddress() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__NotAgent.selector);
        vm.prank(alice);
        reg.registerAgent(bob, bytes32(uint256(1)), "a", "v");
    }

    // Admin has no bypass — the invariant is msg.sender == agent, period.
    function test_evenAdminCannotRegisterOnAgentsBehalf() public {
        address someone = makeAddr("someone");
        vm.prank(admin);
        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__NotAgent.selector);
        reg.registerAgent(someone, bytes32(uint256(1)), "a", "v");
    }

    function test_zeroAddressRejected() public {
        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__ZeroAddress.selector);
        reg.registerAgent(address(0), bytes32(uint256(1)), "a", "v");
    }

    function test_cannotRegisterTwice() public {
        address alice = makeAddr("alice");
        vm.startPrank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzAgentRegistry.AgentRegistry__AlreadyRegistered.selector, alice)
        );
        reg.registerAgent(alice, bytes32(uint256(2)), "a", "v");
        vm.stopPrank();
    }

    // ---------- Controller-only mutations ----------

    function test_controllerCanRotateCredential() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");

        vm.prank(alice);
        reg.rotateCredential(alice, bytes32(uint256(0x2222)));
        assertEq(reg.getAgent(alice).credentialDigest, bytes32(uint256(0x2222)));
    }

    function test_nonControllerCannotRotate() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");

        vm.prank(makeAddr("attacker"));
        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__NotController.selector);
        reg.rotateCredential(alice, bytes32(uint256(0xdead)));
    }

    // Deactivate + reactivate round-trip.
    function test_activateAfterDeactivate() public {
        address alice = makeAddr("alice");
        vm.startPrank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");
        reg.deactivate(alice);
        assertFalse(reg.isActive(alice));
        reg.activate(alice);
        assertTrue(reg.isActive(alice));
        vm.stopPrank();
    }

    // Agent-admin can also deactivate + reactivate (e.g. compliance
    // action). Random EOAs cannot.
    function test_agentAdminCanDeactivateAndReactivate() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");

        // admin holds AGENT_ADMIN_ROLE from initialize.
        vm.prank(admin);
        reg.deactivate(alice);
        assertFalse(reg.isActive(alice));
        vm.prank(admin);
        reg.activate(alice);
        assertTrue(reg.isActive(alice));

        vm.prank(makeAddr("random"));
        vm.expectRevert(IStrimzAgentRegistry.AgentRegistry__NotController.selector);
        reg.deactivate(alice);
    }

    // ---------- Reputation ----------

    function test_adminCanAdjustReputation() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");

        vm.prank(admin);
        reg.adjustReputation(alice, 10);
        assertEq(reg.getAgent(alice).reputationScore, 10);

        vm.prank(admin);
        reg.adjustReputation(alice, -3);
        assertEq(reg.getAgent(alice).reputationScore, 7);
    }

    function test_nonAdminCannotAdjustReputation() public {
        address alice = makeAddr("alice");
        vm.prank(alice);
        reg.registerAgent(alice, bytes32(uint256(1)), "a", "v");

        vm.prank(makeAddr("random"));
        vm.expectRevert();
        reg.adjustReputation(alice, 100);
    }

    // ---------- isActive edge cases ----------

    // Unknown agents read as inactive rather than reverting.
    // Downstream code frequently checks `isActive` in a conditional
    // path; a revert would surprise callers.
    function test_isActiveForUnknownReturnsFalse() public {
        assertFalse(reg.isActive(makeAddr("phantom")));
    }
}
