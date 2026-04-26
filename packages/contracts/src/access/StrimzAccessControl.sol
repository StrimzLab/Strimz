// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @title StrimzAccessControl
/// @notice Shared role constants for every Strimz contract.
///         Uses OpenZeppelin's upgradeable `AccessControl` so derived
///         contracts can sit behind UUPS proxies without storage collision.
abstract contract StrimzAccessControl is AccessControlUpgradeable {
    /// @notice Can pause/unpause and change contract-level parameters.
    bytes32 public constant ADMIN_ROLE = keccak256("STRIMZ_ADMIN_ROLE");

    /// @notice Can authorise UUPS upgrades. In production this is the Timelock.
    bytes32 public constant UPGRADER_ROLE = keccak256("STRIMZ_UPGRADER_ROLE");

    /// @notice Can call scheduled charging and agent action endpoints.
    bytes32 public constant CHARGER_ROLE = keccak256("STRIMZ_CHARGER_ROLE");

    /// @notice Can add/remove tokens from the payment whitelist.
    bytes32 public constant TOKEN_MANAGER_ROLE = keccak256("STRIMZ_TOKEN_MANAGER_ROLE");

    /// @notice Can register new merchants in the registry.
    bytes32 public constant MERCHANT_REGISTRAR_ROLE = keccak256("STRIMZ_MERCHANT_REGISTRAR_ROLE");

    /// @notice Can accrue fees to the FeeCollector (Payments + Subscriptions).
    bytes32 public constant FEE_ACCRUER_ROLE = keccak256("STRIMZ_FEE_ACCRUER_ROLE");

    /// @notice Can withdraw fees from the FeeCollector to the treasury.
    bytes32 public constant TREASURY_ROLE = keccak256("STRIMZ_TREASURY_ROLE");

    /// @notice Can adjust agent reputation scores on the AgentRegistry.
    bytes32 public constant AGENT_ADMIN_ROLE = keccak256("STRIMZ_AGENT_ADMIN_ROLE");
}
