// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title ProxyDeploy
/// @notice Test + script helper for one-shot UUPS proxy deployment.
///         Deploys an ERC-1967 proxy, calls `initialize(data)` atomically.
library ProxyDeploy {
    function deploy(address impl, bytes memory initData) internal returns (address proxy) {
        proxy = address(new ERC1967Proxy(impl, initData));
    }
}
