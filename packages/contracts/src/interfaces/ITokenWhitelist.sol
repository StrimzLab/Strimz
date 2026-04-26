// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITokenWhitelist
/// @notice Governs which ERC20 tokens are accepted as payment / subscription currency.
interface ITokenWhitelist {
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    error TokenWhitelist__NotWhitelisted(address token);
    error TokenWhitelist__AlreadyWhitelisted(address token);
    error TokenWhitelist__ZeroAddress();

    function isWhitelisted(address token) external view returns (bool);
    function add(address token) external;
    function remove(address token) external;
}
