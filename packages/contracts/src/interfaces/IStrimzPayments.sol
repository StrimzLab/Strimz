// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzPayments
/// @notice One-shot payments.
///         - `pay()`                — classic ERC20 pull via `transferFrom`.
///         - `payWithAuthorization()` — EIP-3009 + Strimz PayIntent path.
///           Payer signs two messages: the token's EIP-3009 auth and a
///           Strimz-native intent that binds `merchantId`, `token`,
///           `amount`, `ref`, the auth `nonce`, and the auth `validBefore`.
///           Both signatures come from the same payer key. Anyone (relayer,
///           merchant server) can submit.
interface IStrimzPayments {
    /// @notice EIP-3009 authorization fields the payer signs for the token.
    struct PayAuthorization {
        address from;
        uint256 amount;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }

    /// @notice ECDSA signature triple.
    struct Sig {
        uint8 v;
        bytes32 r;
        bytes32 s;
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
    /// @notice PayIntent signature does not recover to `auth.from`.
    error Payments__InvalidIntent();
    /// @notice Token delivered less than requested — fee-on-transfer,
    ///         rebasing, blocklist. Refuse to book the payment.
    error Payments__NonStandardTransfer();

    /// @param merchantId The merchant receiving the payment.
    /// @param token ERC20 token — must be whitelisted.
    /// @param amount Gross; fee is deducted from this.
    /// @param ref Off-chain reference (hash of the Strimz session id).
    function pay(uint256 merchantId, address token, uint256 amount, bytes32 ref) external;

    /// @notice Submit a payer-signed EIP-3009 + PayIntent pair.
    /// @param merchantId The merchant receiving the payment.
    /// @param token ERC20 token — whitelisted AND `CAP_TRANSFER_AUTH_3009` set.
    /// @param auth EIP-3009 fields the payer signed for the token.
    /// @param ref Off-chain reference. Committed by the PayIntent signature.
    /// @param authSig EIP-3009 signature verified by the token.
    /// @param intentSig Strimz PayIntent signature verified by this contract.
    ///        Binds merchantId + token + amount + auth.nonce + auth.validBefore
    ///        + ref. Prevents an attacker from redirecting `auth` to a
    ///        different merchant.
    function payWithAuthorization(
        uint256 merchantId,
        address token,
        PayAuthorization calldata auth,
        bytes32 ref,
        Sig calldata authSig,
        Sig calldata intentSig
    ) external;
}
