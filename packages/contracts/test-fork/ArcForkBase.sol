// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "../test/Helpers.t.sol";

interface IArcUsdc {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function approve(address spender, uint256 value) external returns (bool);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}

abstract contract ArcForkBase is StrimzTestBase {
    IArcUsdc internal constant ARC_USDC = IArcUsdc(0x3600000000000000000000000000000000000000);
    address internal constant ARC_TESTNET_BLOCKLISTED = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    bytes32 internal constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    function _forkArcTestnet() internal {
        vm.createSelectFork(vm.envString("ARC_TESTNET_RPC_URL"));
        require(block.chainid == 5042002, "ARC_TESTNET_RPC_URL is not Arc testnet");
    }

    function _signArcReceiveWithAuthorization(
        uint256 signerPk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        (v, r, s) = vm.sign(signerPk, keccak256(abi.encodePacked("\x19\x01", ARC_USDC.DOMAIN_SEPARATOR(), structHash)));
    }
}
