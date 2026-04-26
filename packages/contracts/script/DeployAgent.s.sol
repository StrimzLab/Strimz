// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { DeploymentLog } from "./utils/DeploymentLog.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

/// @title DeployAgent
/// @notice Deploys the agent layer (ERC-8004 registry + ERC-8183 escrow) as
///         UUPS proxies via the OpenZeppelin Foundry Upgrades plugin.
///         Requires an already-deployed TokenWhitelist proxy address read
///         from STRIMZ_TOKEN_WHITELIST_ADDRESS.
contract DeployAgent is Script {
    function run() external {
        uint256 pk = vm.envUint("STRIMZ_DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(pk);
        address whitelist = vm.envAddress("STRIMZ_TOKEN_WHITELIST_ADDRESS");

        vm.startBroadcast(pk);

        address agentRegistry = Upgrades.deployUUPSProxy(
            "StrimzAgentRegistry.sol", abi.encodeCall(StrimzAgentRegistry.initialize, (admin))
        );
        address agentEscrow = Upgrades.deployUUPSProxy(
            "StrimzAgentEscrow.sol",
            abi.encodeCall(StrimzAgentEscrow.initialize, (admin, ITokenWhitelist(whitelist)))
        );

        vm.stopBroadcast();

        DeploymentLog.Entry[] memory entries = new DeploymentLog.Entry[](2);
        entries[0] = DeploymentLog.Entry(
            "StrimzAgentRegistry", agentRegistry, Upgrades.getImplementationAddress(agentRegistry)
        );
        entries[1] = DeploymentLog.Entry(
            "StrimzAgentEscrow", agentEscrow, Upgrades.getImplementationAddress(agentEscrow)
        );
        DeploymentLog.append("agent", entries);

        console2.log("Agent deployment recorded in deployments/<chainId>.jsonl");
    }
}
