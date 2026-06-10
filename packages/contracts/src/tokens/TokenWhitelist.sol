// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title TokenWhitelist
/// @notice Registry of ERC20 tokens accepted by Strimz Payments and
///         Subscriptions. Each whitelisted token also carries a
///         capability bitmap declaring which signature-based
///         authorization standards it implements (EIP-2612 `permit`,
///         EIP-3009 `transferWithAuthorization`).
/// @dev    On Arc this starts as { USDC, EURC }, both with the full
///         capability bitmap (0x03) since both tokens implement 2612
///         and 3009 natively. New tokens are added with capabilities
///         zeroed; the token manager must set them explicitly via
///         `setCapabilities` so the bits are never silently inferred.
/// @dev    UUPS upgradeable. Storage lives at an ERC-7201 namespaced
///         slot. The `capabilities` mapping is appended to the Storage
///         struct, which is upgrade-safe because struct fields are
///         laid out sequentially within the ERC-7201 namespace.
/// @custom:oz-upgrades-unsafe-allow constructor
contract TokenWhitelist is ITokenWhitelist, StrimzAccessControl, UUPSUpgradeable {
    /// @notice Bit set when the token implements EIP-2612 `permit()`.
    uint8 public constant CAP_PERMIT_2612 = 1 << 0; // 0x01

    /// @notice Bit set when the token implements EIP-3009
    ///         `transferWithAuthorization()`.
    uint8 public constant CAP_TRANSFER_AUTH_3009 = 1 << 1; // 0x02

    /// @dev Mask of all currently-defined capability bits. Used to reject
    ///      `setCapabilities` calls that include unknown bits.
    uint8 private constant ALL_CAPS = CAP_PERMIT_2612 | CAP_TRANSFER_AUTH_3009;

    /// @custom:storage-location erc7201:strimz.storage.TokenWhitelist
    struct Storage {
        mapping(address token => bool whitelisted) whitelisted;
        mapping(address token => uint8 capabilities) capabilities;
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
        // Clear capabilities on removal so a re-add starts from a clean
        // slate. Re-adding is a deliberate operation; we don't want stale
        // capability state to silently revive.
        if ($.capabilities[token] != 0) {
            delete $.capabilities[token];
            emit TokenCapabilitiesSet(token, 0);
        }
        emit TokenRemoved(token);
    }

    /// @inheritdoc ITokenWhitelist
    function setCapabilities(
        address token,
        uint8 capabilities
    ) external override onlyRole(TOKEN_MANAGER_ROLE) {
        Storage storage $ = _s();
        if (!$.whitelisted[token]) revert TokenWhitelist__NotWhitelisted(token);
        // Reject any bits the contract doesn't recognise; this guards
        // against the operator setting forward-compatible flags that
        // downstream contracts wouldn't yet enforce.
        if (capabilities & ~ALL_CAPS != 0) {
            revert TokenWhitelist__InvalidCapability(capabilities);
        }
        $.capabilities[token] = capabilities;
        emit TokenCapabilitiesSet(token, capabilities);
    }

    /// @inheritdoc ITokenWhitelist
    function isWhitelisted(address token) external view override returns (bool) {
        return _s().whitelisted[token];
    }

    /// @inheritdoc ITokenWhitelist
    function getCapabilities(address token) external view override returns (uint8) {
        return _s().capabilities[token];
    }

    /// @inheritdoc ITokenWhitelist
    function supportsCapability(
        address token,
        uint8 capability
    ) external view override returns (bool) {
        // The single-bit `capability` argument is intersected with the
        // token's stored bitmap. Returns false for unknown tokens
        // (capabilities default to 0) and false for an empty `capability`
        // argument (so callers cannot accidentally pass 0 and get true).
        if (capability == 0) return false;
        return _s().capabilities[token] & capability == capability;
    }
}
