// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

import { AdminHandoff } from "./utils/AdminHandoff.sol";
import { DeploymentLog } from "./utils/DeploymentLog.sol";

contract HandoffAdmin is Script {
    function run() external {
        uint256 pk = vm.envUint("STRIMZ_DEPLOYER_PRIVATE_KEY");
        uint256 minDelay = vm.envUint("TIMELOCK_MIN_DELAY");

        AdminHandoff.Contracts memory c = AdminHandoff.Contracts({
            registry: vm.envAddress("STRIMZ_REGISTRY_ADDRESS"),
            tokenWhitelist: vm.envAddress("STRIMZ_TOKEN_WHITELIST_ADDRESS"),
            feeCollector: vm.envAddress("STRIMZ_FEE_COLLECTOR_ADDRESS"),
            payments: vm.envAddress("STRIMZ_PAYMENTS_ADDRESS"),
            subscriptions: vm.envAddress("STRIMZ_SUBSCRIPTIONS_ADDRESS"),
            agentRegistry: vm.envAddress("STRIMZ_AGENT_REGISTRY_ADDRESS"),
            agentEscrow: vm.envAddress("STRIMZ_AGENT_ESCROW_ADDRESS")
        });
        AdminHandoff.Holders memory h = AdminHandoff.Holders({
            safe: vm.envAddress("STRIMZ_SAFE_ADDRESS"),
            guardian: vm.envOr("STRIMZ_GUARDIAN_ADDRESS", address(0)),
            relayer: vm.envAddress("STRIMZ_RELAYER_ADDRESS"),
            scheduler: vm.envAddress("STRIMZ_SCHEDULER_ADDRESS"),
            deployer: vm.addr(pk)
        });

        vm.startBroadcast(pk);
        TimelockController timelock = AdminHandoff.run(c, h, minDelay);
        vm.stopBroadcast();

        console2.log("TimelockController:", address(timelock));
        console2.log("Min delay (seconds):", minDelay);
        console2.log("Safe:", h.safe);
        console2.log("Guardian:", h.guardian);

        DeploymentLog.appendSingle("handoff", h.deployer, "TimelockController", address(timelock), address(timelock));
    }
}
