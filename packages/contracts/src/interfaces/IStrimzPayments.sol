// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzPayments
/// @notice One-shot payments. Pull-based using ERC20 `transferFrom` — the payer
///         must pre-approve the contract. The net amount goes to the merchant's
///         payout address and the fee is accrued to the FeeCollector.
interface IStrimzPayments {
    event PaymentExecuted(
        uint256 indexed merchantId,
        address indexed payer,
        address indexed token,
        uint256 amount,
        uint256 feeAmount,
        uint256 netAmount,
        bytes32 ref
    );

    error Payments__InvalidToken(address token);
    error Payments__InvalidAmount();
    error Payments__MerchantInactive(uint256 merchantId);
    error Payments__TransferFailed();

    /// @param merchantId The merchant receiving the payment.
    /// @param token ERC20 token address — must be in the whitelist.
    /// @param amount Gross amount the payer is charged; fee is deducted from this.
    /// @param ref Off-chain reference (e.g. hash of the Strimz session id).
    function pay(uint256 merchantId, address token, uint256 amount, bytes32 ref) external;
}
