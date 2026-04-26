// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { StrimzAccessControl } from "./StrimzAccessControl.sol";

/// @title StrimzPausable
/// @notice Global kill switch gated by ADMIN_ROLE. Every value-moving
///         function in the Strimz system respects this.
abstract contract StrimzPausable is PausableUpgradeable, StrimzAccessControl {
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
