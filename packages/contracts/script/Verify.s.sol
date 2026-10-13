// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { AdminHandoff } from "./utils/AdminHandoff.sol";

/// @title Verify
/// @notice Reads the live state of every contract written by DeployCore
///         on the target RPC and asserts the wiring is correct. Run by
///         hand after every deployment. Reverts loud if any pointer,
///         role, or admin assignment is wrong.
///
///         Addresses are taken from env vars (see usage block below)
///         rather than parsed from the JSONL audit trail. Read them
///         from `deployments/<chainId>.jsonl` and export them in your
///         shell before invoking the script.
///
/// Usage:
///   STRIMZ_ADMIN_ADDRESS=0x...                \
///   STRIMZ_REGISTRY_ADDRESS=0x...             \
///   STRIMZ_TOKEN_WHITELIST_ADDRESS=0x...      \
///   STRIMZ_FEE_COLLECTOR_ADDRESS=0x...        \
///   STRIMZ_PAYMENTS_ADDRESS=0x...             \
///   STRIMZ_SUBSCRIPTIONS_ADDRESS=0x...        \
///   forge script script/Verify.s.sol --rpc-url arc_testnet
contract Verify is Script {
    function run() external view {
        string memory phase = vm.envString("STRIMZ_VERIFY_PHASE");
        bool handedOff = _eq(phase, "handed-off");
        if (!handedOff && !_eq(phase, "deployed")) {
            revert(string.concat("STRIMZ_VERIFY_PHASE must be deployed or handed-off, got ", phase));
        }
        address admin = handedOff ? address(0) : vm.envAddress("STRIMZ_ADMIN_ADDRESS");
        address registry = vm.envAddress("STRIMZ_REGISTRY_ADDRESS");
        address whitelist = vm.envAddress("STRIMZ_TOKEN_WHITELIST_ADDRESS");
        address feeCollector = vm.envAddress("STRIMZ_FEE_COLLECTOR_ADDRESS");
        address payments = vm.envAddress("STRIMZ_PAYMENTS_ADDRESS");
        address subs = vm.envAddress("STRIMZ_SUBSCRIPTIONS_ADDRESS");
        address agentRegistry = vm.envAddress("STRIMZ_AGENT_REGISTRY_ADDRESS");
        address agentEscrow = vm.envAddress("STRIMZ_AGENT_ESCROW_ADDRESS");

        console2.log("=== Strimz deployment verification ===");
        console2.log("chainId:", block.chainid);
        console2.log("phase:  ", phase);
        console2.log("admin:  ", admin);
        console2.log("");

        bytes32 defaultAdmin = 0x00;

        if (handedOff) {
            _verifyHandedOff(
                AdminHandoff.Contracts({
                    registry: registry,
                    tokenWhitelist: whitelist,
                    feeCollector: feeCollector,
                    payments: payments,
                    subscriptions: subs,
                    agentRegistry: agentRegistry,
                    agentEscrow: agentEscrow
                })
            );
        } else {
            // 1. Admin role granted to the deployer on every contract.
            _requireRole("StrimzRegistry      [DEFAULT_ADMIN_ROLE]", registry, defaultAdmin, admin);
            _requireRole("TokenWhitelist      [DEFAULT_ADMIN_ROLE]", whitelist, defaultAdmin, admin);
            _requireRole("FeeCollector        [DEFAULT_ADMIN_ROLE]", feeCollector, defaultAdmin, admin);
            _requireRole("StrimzPayments      [DEFAULT_ADMIN_ROLE]", payments, defaultAdmin, admin);
            _requireRole("StrimzSubscriptions [DEFAULT_ADMIN_ROLE]", subs, defaultAdmin, admin);
            _requireRole("StrimzAgentRegistry [DEFAULT_ADMIN_ROLE]", agentRegistry, defaultAdmin, admin);
            _requireRole("StrimzAgentEscrow   [DEFAULT_ADMIN_ROLE]", agentEscrow, defaultAdmin, admin);
        }

        // 2. FEE_ACCRUER_ROLE wired so Payments and Subscriptions can credit fees.
        bytes32 accruerRole = StrimzAccessControl(feeCollector).FEE_ACCRUER_ROLE();
        _requireRole("FeeCollector.FEE_ACCRUER_ROLE -> Payments", feeCollector, accruerRole, payments);
        _requireRole("FeeCollector.FEE_ACCRUER_ROLE -> Subscriptions", feeCollector, accruerRole, subs);

        // 3. Dependency pointers on the value-moving contracts.
        require(address(StrimzPayments(payments).registry()) == registry, "Payments.registry mismatch");
        require(
            address(StrimzPayments(payments).feeCollector()) == feeCollector, "Payments.feeCollector mismatch"
        );
        require(
            address(StrimzPayments(payments).tokenWhitelist()) == whitelist, "Payments.tokenWhitelist mismatch"
        );
        require(address(StrimzSubscriptions(subs).registry()) == registry, "Subs.registry mismatch");
        require(
            address(StrimzSubscriptions(subs).feeCollector()) == feeCollector, "Subs.feeCollector mismatch"
        );
        require(
            address(StrimzSubscriptions(subs).tokenWhitelist()) == whitelist, "Subs.tokenWhitelist mismatch"
        );
        console2.log("[ok] dependency pointers wired on Payments + Subscriptions");

        // 4. UUPS proxies have implementations set (sanity, not the layout check).
        require(Upgrades.getImplementationAddress(registry) != address(0), "Registry: empty impl");
        require(Upgrades.getImplementationAddress(whitelist) != address(0), "Whitelist: empty impl");
        require(Upgrades.getImplementationAddress(feeCollector) != address(0), "FeeCollector: empty impl");
        require(Upgrades.getImplementationAddress(agentRegistry) != address(0), "AgentRegistry: empty impl");
        require(Upgrades.getImplementationAddress(agentEscrow) != address(0), "AgentEscrow: empty impl");
        require(
            address(StrimzAgentEscrow(agentEscrow).tokenWhitelist()) == whitelist, "AgentEscrow.tokenWhitelist mismatch"
        );
        console2.log("[ok] UUPS proxies have implementations set");

        // 5. Optional: token whitelist seed check. Only enforced when
        //    the deploy script was given ARC_USDC_ADDRESS / ARC_EURC_ADDRESS.
        address usdc = vm.envOr("ARC_USDC_ADDRESS", address(0));
        address eurc = vm.envOr("ARC_EURC_ADDRESS", address(0));
        if (usdc != address(0)) {
            require(TokenWhitelist(whitelist).isWhitelisted(usdc), "USDC not in whitelist");
            _requireBothCapabilities("USDC", whitelist, usdc);
            console2.log("[ok] USDC whitelisted:", usdc);
        }
        if (eurc != address(0)) {
            require(TokenWhitelist(whitelist).isWhitelisted(eurc), "EURC not in whitelist");
            _requireBothCapabilities("EURC", whitelist, eurc);
            console2.log("[ok] EURC whitelisted:", eurc);
        }

        console2.log("");
        console2.log("=== all checks passed ===");
    }

    function _verifyHandedOff(AdminHandoff.Contracts memory c) internal view {
        address timelock = vm.envAddress("STRIMZ_TIMELOCK_ADDRESS");
        uint256 minDelay = vm.envUint("TIMELOCK_MIN_DELAY");
        AdminHandoff.Holders memory h = AdminHandoff.Holders({
            safe: vm.envAddress("STRIMZ_SAFE_ADDRESS"),
            guardian: vm.envOr("STRIMZ_GUARDIAN_ADDRESS", address(0)),
            relayer: vm.envAddress("STRIMZ_RELAYER_ADDRESS"),
            scheduler: vm.envAddress("STRIMZ_SCHEDULER_ADDRESS"),
            deployer: vm.envAddress("STRIMZ_DEPLOYER_ADDRESS")
        });

        TimelockController tl = TimelockController(payable(timelock));
        require(tl.getMinDelay() == minDelay, "Timelock min delay mismatch");
        require(tl.hasRole(tl.PROPOSER_ROLE(), h.safe), "Timelock: Safe is not the proposer");
        require(tl.hasRole(tl.EXECUTOR_ROLE(), address(0)), "Timelock: execution is not open");
        console2.log("[ok] timelock delay, proposer and executor");

        AdminHandoff.verify(c, h, timelock, AdminHandoff.roleTable(c, h, timelock));
        console2.log("[ok] post-handoff role table; deployer holds no role");
    }

    function _requireBothCapabilities(string memory label, address whitelist, address token) internal view {
        TokenWhitelist w = TokenWhitelist(whitelist);
        require(
            w.supportsCapability(token, w.CAP_PERMIT_2612()) && w.supportsCapability(token, w.CAP_TRANSFER_AUTH_3009()),
            string.concat(label, " is missing a capability flag")
        );
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _requireRole(string memory label, address target, bytes32 role, address account) internal view {
        require(
            IAccessControl(target).hasRole(role, account), string.concat("Role missing on ", label)
        );
        console2.log("[ok]", label);
    }
}
