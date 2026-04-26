// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title TokenWhitelist
/// @notice Registry of ERC20 tokens accepted by Strimz Payments and
///         Subscriptions. On Arc this starts as { USDC, EURC }.
/// @dev UUPS upgradeable. Storage lives at an ERC-7201 namespaced slot.
/// @custom:oz-upgrades-unsafe-allow constructor
contract TokenWhitelist is ITokenWhitelist, StrimzAccessControl, UUPSUpgradeable {
    /// @custom:storage-location erc7201:strimz.storage.TokenWhitelist
    struct Storage {
        mapping(address token => bool whitelisted) whitelisted;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.TokenWhitelist")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0x08e24024fb4a01f7ad063fea9b9a98a281a1c023147b883aac093d216fefa000;

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        if (admin == address(0)) revert TokenWhitelist__ZeroAddress();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(TOKEN_MANAGER_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    /// @inheritdoc ITokenWhitelist
    function add(address token) external override onlyRole(TOKEN_MANAGER_ROLE) {
        if (token == address(0)) revert TokenWhitelist__ZeroAddress();
        Storage storage $ = _s();
        if ($.whitelisted[token]) revert TokenWhitelist__AlreadyWhitelisted(token);
        $.whitelisted[token] = true;
        emit TokenAdded(token);
    }

    /// @inheritdoc ITokenWhitelist
    function remove(address token) external override onlyRole(TOKEN_MANAGER_ROLE) {
        Storage storage $ = _s();
        if (!$.whitelisted[token]) revert TokenWhitelist__NotWhitelisted(token);
        $.whitelisted[token] = false;
        emit TokenRemoved(token);
    }

    /// @inheritdoc ITokenWhitelist
    function isWhitelisted(address token) external view override returns (bool) {
        return _s().whitelisted[token];
    }
}
