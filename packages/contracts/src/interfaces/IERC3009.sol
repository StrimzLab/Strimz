// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IERC3009
/// @notice Minimal interface for the subset of EIP-3009 that Strimz uses.
/// @dev    USDC and EURC on Arc both implement this. `receiveWithAuthorization`
///         is preferred over `transferWithAuthorization` because the token
///         enforces `msg.sender == to`, which gives front-running protection:
///         a relayer cannot have someone else's signature submitted into a
///         different recipient context.
///
/// @dev    The EIP-712 typed-data hashed by the token implementation:
///
///         struct ReceiveWithAuthorization {
///             address from;
///             address to;
///             uint256 value;
///             uint256 validAfter;
///             uint256 validBefore;
///             bytes32 nonce;
///         }
///
///         The signature `(v, r, s)` is produced over the EIP-712 hash of the
///         above structure. The token contract recovers the signer and must
///         match `from`; otherwise the call reverts.
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @return Whether the given `nonce` has already been used by `authorizer`.
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}
