// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { IStrimzAgentRegistry } from "../src/interfaces/IStrimzAgentRegistry.sol";

contract StrimzAgentRegistryTest is StrimzTestBase {
    StrimzAgentRegistry internal reg;
    address internal agentAddr = makeAddr("agent");

    function setUp() public {
        reg = _deployAgentRegistry(admin);
    }

    function test_registerAndReadAgent() public {
        vm.prank(admin);
        reg.registerAgent(agentAddr, bytes32(uint256(1)), "Strimz AutoPay", "1.0.0");

        IStrimzAgentRegistry.Agent memory a = reg.getAgent(agentAddr);
        assertEq(a.controller, admin);
        assertEq(a.name, "Strimz AutoPay");
        assertTrue(a.active);
        assertTrue(reg.isActive(agentAddr));
    }

    function test_cannotRegisterTwice() public {
        vm.startPrank(admin);
        reg.registerAgent(agentAddr, bytes32(uint256(1)), "Agent", "v1");
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzAgentRegistry.AgentRegistry__AlreadyRegistered.selector, agentAddr)
        );
        reg.registerAgent(agentAddr, bytes32(uint256(2)), "Agent", "v1");
        vm.stopPrank();
    }

    function test_adminCanAdjustReputation() public {
        vm.prank(admin);
        reg.registerAgent(agentAddr, bytes32(uint256(1)), "A", "v1");

        vm.prank(admin);
        reg.adjustReputation(agentAddr, 10);
        assertEq(reg.getAgent(agentAddr).reputationScore, 10);

        vm.prank(admin);
        reg.adjustReputation(agentAddr, -3);
        assertEq(reg.getAgent(agentAddr).reputationScore, 7);
    }
}
