// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { DeploymentLog } from "./utils/DeploymentLog.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../src/interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

/// @title DeployCore
/// @notice Deploys the non-agent core: Registry, TokenWhitelist, FeeCollector,
///         Payments, Subscriptions — each as a UUPS proxy via the OpenZeppelin
///         Foundry Upgrades plugin. The plugin runs a storage-layout safety
///         check before each deployment. Wires FEE_ACCRUER_ROLE. Appends a
///         JSON record to `deployments/<chainId>.jsonl`.
contract DeployCore is Script {
    function run() external {
        uint256 pk = vm.envUint("STRIMZ_DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        address registry =
            Upgrades.deployUUPSProxy("StrimzRegistry.sol", abi.encodeCall(StrimzRegistry.initialize, (admin)));
        address whitelist =
            Upgrades.deployUUPSProxy("TokenWhitelist.sol", abi.encodeCall(TokenWhitelist.initialize, (admin)));
        address feeCollector =
            Upgrades.deployUUPSProxy("FeeCollector.sol", abi.encodeCall(FeeCollector.initialize, (admin)));
        address payments = Upgrades.deployUUPSProxy(
            "StrimzPayments.sol",
            abi.encodeCall(
                StrimzPayments.initialize,
                (admin, IStrimzRegistry(registry), IFeeCollector(feeCollector), ITokenWhitelist(whitelist))
            )
        );
        address subs = Upgrades.deployUUPSProxy(
            "StrimzSubscriptions.sol",
            abi.encodeCall(
                StrimzSubscriptions.initialize,
                (admin, IStrimzRegistry(registry), IFeeCollector(feeCollector), ITokenWhitelist(whitelist))
            )
        );

        // Wire FEE_ACCRUER_ROLE so Payments and Subscriptions can credit fees.
        bytes32 accruerRole = StrimzAccessControl(feeCollector).FEE_ACCRUER_ROLE();
        FeeCollector(feeCollector).grantRole(accruerRole, payments);
        FeeCollector(feeCollector).grantRole(accruerRole, subs);

        // Optional initial token allowlist seeding.
        address usdc = vm.envOr("ARC_USDC_ADDRESS", address(0));
        address eurc = vm.envOr("ARC_EURC_ADDRESS", address(0));
        if (usdc != address(0)) TokenWhitelist(whitelist).add(usdc);
        if (eurc != address(0)) TokenWhitelist(whitelist).add(eurc);

        vm.stopBroadcast();

        // ----- Append to the deployment audit trail -----
        DeploymentLog.Entry[] memory entries = new DeploymentLog.Entry[](5);
        entries[0] =
            DeploymentLog.Entry("StrimzRegistry", registry, Upgrades.getImplementationAddress(registry));
        entries[1] =
            DeploymentLog.Entry("TokenWhitelist", whitelist, Upgrades.getImplementationAddress(whitelist));
        entries[2] =
            DeploymentLog.Entry("FeeCollector", feeCollector, Upgrades.getImplementationAddress(feeCollector));
        entries[3] =
            DeploymentLog.Entry("StrimzPayments", payments, Upgrades.getImplementationAddress(payments));
        entries[4] =
            DeploymentLog.Entry("StrimzSubscriptions", subs, Upgrades.getImplementationAddress(subs));
        DeploymentLog.append("core", entries);

        console2.log("Core deployment recorded in deployments/<chainId>.jsonl");
    }
}
