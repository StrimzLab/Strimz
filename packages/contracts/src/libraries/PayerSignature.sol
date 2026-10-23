// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice A payer without code signs with a key; one with code (a smart
///         wallet or EIP-7702 account) answers through ERC-1271, which is
///         also how FiatToken decides.
library PayerSignature {
    function isValid(address signer, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (signer.code.length != 0) {
            return SignatureChecker.isValidERC1271SignatureNowCalldata(signer, digest, signature);
        }
        (bool ok, uint8 v, bytes32 r, bytes32 s) = split(signature);
        if (!ok) return false;
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, v, r, s);
        return err == ECDSA.RecoverError.NoError && recovered == signer;
    }

    /// @dev Some wallets return `v` as 0/1; the token wants 27/28.
    function split(bytes calldata signature) internal pure returns (bool ok, uint8 v, bytes32 r, bytes32 s) {
        ok = signature.length == 65;
        if (!ok) return (ok, 0, 0, 0);
        r = bytes32(signature[0:32]);
        s = bytes32(signature[32:64]);
        v = uint8(signature[64]);
        if (v < 27) v += 27;
    }
}
