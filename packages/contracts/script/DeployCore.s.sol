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
/// @notice Deploys the non-agent core. Three of the contracts are UUPS
///         proxies (policy-bearing — Registry, TokenWhitelist,
///         FeeCollector); two are direct deploys without a proxy because
///         they are deliberately immutable (Payments, Subscriptions). This
///         split is documented in the Strimz whitepaper Section 4 as a
///         security-posture choice — the value-moving paths cannot be
///         upgraded in place. The OpenZeppelin Foundry Upgrades plugin
///         runs the storage-layout safety check on the upgradeable three.
///         FEE_ACCRUER_ROLE is wired so Payments and Subscriptions can
///         credit the FeeCollector. A JSON record of the deployment is
///         appended to `deployments/<chainId>.jsonl`. For the immutable
///         contracts, the "implementation address" column duplicates the
///         contract address — there is no separate implementation.
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

        // Direct deploys — no proxy. Constructor sets state in one phase
        // with the `initializer` modifier preventing any re-init.
        StrimzPayments payments = new StrimzPayments(
            admin, IStrimzRegistry(registry), IFeeCollector(feeCollector), ITokenWhitelist(whitelist)
        );
        StrimzSubscriptions subs = new StrimzSubscriptions(
            admin, IStrimzRegistry(registry), IFeeCollector(feeCollector), ITokenWhitelist(whitelist)
        );

        // Wire FEE_ACCRUER_ROLE so Payments and Subscriptions can credit fees.
        bytes32 accruerRole = StrimzAccessControl(feeCollector).FEE_ACCRUER_ROLE();
        FeeCollector(feeCollector).grantRole(accruerRole, address(payments));
        FeeCollector(feeCollector).grantRole(accruerRole, address(subs));

        // Optional initial token allowlist seeding.
        address usdc = vm.envOr("ARC_USDC_ADDRESS", address(0));
        address eurc = vm.envOr("ARC_EURC_ADDRESS", address(0));
        if (usdc != address(0)) TokenWhitelist(whitelist).add(usdc);
        if (eurc != address(0)) TokenWhitelist(whitelist).add(eurc);

        vm.stopBroadcast();

        // ----- Append to the deployment audit trail -----
        // For the immutable contracts, the "implementation" field
        // duplicates the deployed address — there is no separate impl.
        DeploymentLog.Entry[] memory entries = new DeploymentLog.Entry[](5);
        entries[0] =
            DeploymentLog.Entry("StrimzRegistry", registry, Upgrades.getImplementationAddress(registry));
        entries[1] =
            DeploymentLog.Entry("TokenWhitelist", whitelist, Upgrades.getImplementationAddress(whitelist));
        entries[2] =
            DeploymentLog.Entry("FeeCollector", feeCollector, Upgrades.getImplementationAddress(feeCollector));
        entries[3] = DeploymentLog.Entry("StrimzPayments", address(payments), address(payments));
        entries[4] = DeploymentLog.Entry("StrimzSubscriptions", address(subs), address(subs));
        DeploymentLog.append("core", entries);

        console2.log("Core deployment recorded in deployments/<chainId>.jsonl");
    }
}
