// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzPayments
/// @notice One-shot payments. Two entrypoints:
///         - `pay()`                — classic pull via ERC20 `transferFrom`;
///           the payer must pre-approve. Works for any whitelisted token.
///         - `payWithAuthorization()` — EIP-3009 path. The payer signs a
///           single off-chain authorization; a relayer (or anyone) submits.
///           Works only for whitelisted tokens that have the
///           `CAP_TRANSFER_AUTH_3009` capability bit set on TokenWhitelist.
///
///         Both paths emit the same `PaymentExecuted` event shape so the
///         indexer needs no path-specific logic.
interface IStrimzPayments {
    /// @notice EIP-3009 authorization fields the payer signs over.
    /// @dev    Matches the `ReceiveWithAuthorization` typed-data structure
    ///         the token contract hashes for signature verification.
    struct PayAuthorization {
        address from;        // The payer; recovered + checked by the token
        uint256 amount;      // Gross amount; fee is deducted from this
        uint256 validAfter;  // Unix timestamp; authorization invalid before this
        uint256 validBefore; // Unix timestamp; authorization invalid after this
        bytes32 nonce;       // Single-use nonce; the token enforces non-replay
    }

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
    error Payments__UnsupportedCapability(address token);

    /// @param merchantId The merchant receiving the payment.
    /// @param token ERC20 token address — must be in the whitelist.
    /// @param amount Gross amount the payer is charged; fee is deducted from this.
    /// @param ref Off-chain reference (e.g. hash of the Strimz session id).
    function pay(uint256 merchantId, address token, uint256 amount, bytes32 ref) external;

    /// @notice Submit a payer-signed EIP-3009 authorization. The full
    ///         `auth.amount` lands in this contract via the token's
    ///         `receiveWithAuthorization`, then is split into fee +
    ///         merchant payout exactly as `pay()` does. The payer signs
    ///         once and never broadcasts a transaction.
    /// @param merchantId The merchant receiving the payment.
    /// @param token ERC20 token address — must be in the whitelist AND
    ///        have `CAP_TRANSFER_AUTH_3009` set on TokenWhitelist.
    /// @param auth EIP-3009 authorization fields the payer signed.
    /// @param ref Off-chain reference.
    /// @param v Signature v component.
    /// @param r Signature r component.
    /// @param s Signature s component.
    function payWithAuthorization(
        uint256 merchantId,
        address token,
        PayAuthorization calldata auth,
        bytes32 ref,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
