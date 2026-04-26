// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IFeeCollector
/// @notice Accumulates protocol fees with pull-payment withdrawal.
/// @dev Payments and Subscriptions call `accrue` after every settled transfer;
///      the treasury calls `withdraw` on a schedule.
interface IFeeCollector {
    event FeeAccrued(address indexed token, uint256 indexed merchantId, uint256 amount);
    event FeeWithdrawn(address indexed token, address indexed to, uint256 amount);

    error FeeCollector__UnauthorisedAccruer();
    error FeeCollector__ZeroAmount();
    error FeeCollector__InsufficientBalance();

    function accrue(address token, uint256 merchantId, uint256 amount) external;
    function withdraw(address token, address to, uint256 amount) external;
    function balanceOf(address token) external view returns (uint256);
    function totalAccrued(address token) external view returns (uint256);
}
