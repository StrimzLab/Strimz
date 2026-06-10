// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IERC2612
/// @notice Minimal interface for the subset of EIP-2612 that Strimz uses.
/// @dev    USDC, EURC, DAI, and most modern stablecoins implement this.
///         A payer signs an EIP-712 message authorising `spender` to
///         transfer up to `value` of their balance until `deadline`,
///         then any party submits the signature via `permit()`. The
///         token contract recovers the signer, checks it matches
///         `owner`, advances `owner`'s nonce by one, and sets the
///         allowance — atomic with the call.
///
/// @dev    The EIP-712 typed-data hashed by the token implementation:
///
///         struct Permit {
///             address owner;
///             address spender;
///             uint256 value;
///             uint256 nonce;
///             uint256 deadline;
///         }
///
///         The nonce is fetched off-chain via `nonces(owner)` and is
///         consumed atomically with the permit. Replays are impossible.
interface IERC2612 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @return The next nonce expected for `owner`'s permit signatures.
    function nonces(address owner) external view returns (uint256);

    /// @return The EIP-712 domain separator the token uses for signature
    ///         verification. Off-chain SDKs read this to build the typed
    ///         data without hard-coding chain ids or contract addresses.
    /// @dev The name is fixed by EIP-2612 and must match exactly. The
    ///      solhint and forge-lint suppressions below acknowledge the
    ///      external constraint on the casing.
    // solhint-disable-next-line func-name-mixedcase
    // forge-lint: disable-next-line(mixed-case-function)
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
