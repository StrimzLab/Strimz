// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";

/// @dev Minimal USDC surface read to build the typed-data digests.
interface IUSDC {
    function nonces(address owner) external view returns (uint256);
    // Casing fixed by USDC's on-chain ABI.
    // forge-lint: disable-next-line(mixed-case-function)
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    // forge-lint: disable-next-line(mixed-case-function)
    function RECEIVE_WITH_AUTHORIZATION_TYPEHASH() external view returns (bytes32);
}

/// @title Digests
/// @notice EIP-712 signing helpers for the e2e shell driver. The payer's
///         private key is read from `STRIMZ_PAYER_PRIVATE_KEY` at runtime
///         and signing happens here via `vm.sign`, so the shell never has
///         to invoke `cast wallet sign`.
///
///         Output format: three marker lines per call:
///             __SIG_V__=<uint8>
///             __SIG_R__=0x<64 hex>
///             __SIG_S__=0x<64 hex>
///         The shell extracts them with grep.
contract Digests is Script {
    bytes32 private constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    /// @notice Compute the EIP-3009 `ReceiveWithAuthorization` digest and
    ///         sign it with the payer's key.
    function signReceiveWithAuth(
        address payer,
        address to,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) external view {
        IUSDC usdc = IUSDC(vm.envAddress("ARC_USDC_ADDRESS"));
        bytes32 structHash = keccak256(
            abi.encode(
                usdc.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                payer,
                to,
                amount,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        _emitSig(digest);
    }

    /// @notice Compute the EIP-2612 `Permit` digest and sign it with the
    ///         payer's key. Reads the payer's live permit nonce so the
    ///         message is valid against the current USDC state.
    function signPermit(address payer, address spender, uint256 value, uint256 deadline)
        external
        view
    {
        IUSDC usdc = IUSDC(vm.envAddress("ARC_USDC_ADDRESS"));
        uint256 nonce = usdc.nonces(payer);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, spender, value, nonce, deadline));
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        _emitSig(digest);
    }

    function _emitSig(bytes32 digest) private view {
        uint256 payerKey = vm.envUint("STRIMZ_PAYER_PRIVATE_KEY");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerKey, digest);
        console2.log(string.concat("__SIG_V__=", vm.toString(v)));
        console2.log(string.concat("__SIG_R__=", vm.toString(r)));
        console2.log(string.concat("__SIG_S__=", vm.toString(s)));
    }
}
