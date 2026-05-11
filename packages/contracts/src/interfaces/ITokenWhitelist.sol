// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITokenWhitelist
/// @notice Registry of ERC20 tokens accepted by Strimz Payments and
///         Subscriptions, plus a per-token capability bitmap that
///         declares which signature-based authorization standards each
///         token supports.
/// @dev    Capability bits drive `StrimzPayments.payWithAuthorization`
///         (EIP-3009) and `StrimzSubscriptions.permitAndCreateSubscription`
///         (EIP-2612). The existing `pay()` and `createSubscription()`
///         entrypoints work for any whitelisted token regardless of caps.
interface ITokenWhitelist {
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event TokenCapabilitiesSet(address indexed token, uint8 capabilities);

    error TokenWhitelist__NotWhitelisted(address token);
    error TokenWhitelist__AlreadyWhitelisted(address token);
    error TokenWhitelist__ZeroAddress();
    error TokenWhitelist__InvalidCapability(uint8 capabilities);

    /// @return Whether `token` is currently in the whitelist.
    function isWhitelisted(address token) external view returns (bool);

    /// @notice Add `token` with capabilities zeroed. Caller must follow up
    ///         with `setCapabilities` if the token implements 2612 or 3009.
    function add(address token) external;

    /// @notice Remove `token` from the whitelist and clear its capabilities.
    function remove(address token) external;

    /// @notice Set the capability bitmap for an already-whitelisted token.
    /// @param token         A token currently on the whitelist.
    /// @param capabilities  A bitmap of `CAP_PERMIT_2612` and/or `CAP_TRANSFER_AUTH_3009`.
    function setCapabilities(address token, uint8 capabilities) external;

    /// @return The full capability bitmap for `token`. Zero if the token
    ///         is unknown or has no capabilities declared.
    function getCapabilities(address token) external view returns (uint8);

    /// @return True if `token` has the specific `capability` bit set.
    function supportsCapability(address token, uint8 capability) external view returns (bool);
}
