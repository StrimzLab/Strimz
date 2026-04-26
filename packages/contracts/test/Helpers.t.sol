// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { ProxyDeploy } from "../script/utils/ProxyDeploy.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../src/interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

/// @dev Minimal mock token for local test usage — USDC-shaped (6 decimals).
contract MockUsdc is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Base test harness — provides labelled actors, a mock USDC, and
///      proxy-deploy helpers for every Strimz contract.
abstract contract StrimzTestBase is Test {
    address internal admin = makeAddr("admin");
    address internal merchant = makeAddr("merchant");
    address internal merchantPayout = makeAddr("merchantPayout");
    address internal payer = makeAddr("payer");
    address internal vendor = makeAddr("vendor");
    address internal assessor = makeAddr("assessor");
    address internal treasury = makeAddr("treasury");

    MockUsdc internal usdc;

    function _setUpTokens() internal {
        usdc = new MockUsdc();
    }

    function _fund(address to, uint256 amount) internal {
        usdc.mint(to, amount);
    }

    // ----- Proxy-deploy helpers -----

    function _deployTokenWhitelist(address admin_) internal returns (TokenWhitelist) {
        TokenWhitelist impl = new TokenWhitelist();
        bytes memory data = abi.encodeCall(TokenWhitelist.initialize, (admin_));
        return TokenWhitelist(ProxyDeploy.deploy(address(impl), data));
    }

    function _deployFeeCollector(address admin_) internal returns (FeeCollector) {
        FeeCollector impl = new FeeCollector();
        bytes memory data = abi.encodeCall(FeeCollector.initialize, (admin_));
        return FeeCollector(ProxyDeploy.deploy(address(impl), data));
    }

    function _deployRegistry(address admin_) internal returns (StrimzRegistry) {
        StrimzRegistry impl = new StrimzRegistry();
        bytes memory data = abi.encodeCall(StrimzRegistry.initialize, (admin_));
        return StrimzRegistry(ProxyDeploy.deploy(address(impl), data));
    }

    function _deployPayments(
        address admin_,
        IStrimzRegistry r,
        IFeeCollector f,
        ITokenWhitelist t
    ) internal returns (StrimzPayments) {
        StrimzPayments impl = new StrimzPayments();
        bytes memory data = abi.encodeCall(StrimzPayments.initialize, (admin_, r, f, t));
        return StrimzPayments(ProxyDeploy.deploy(address(impl), data));
    }

    function _deploySubscriptions(
        address admin_,
        IStrimzRegistry r,
        IFeeCollector f,
        ITokenWhitelist t
    ) internal returns (StrimzSubscriptions) {
        StrimzSubscriptions impl = new StrimzSubscriptions();
        bytes memory data = abi.encodeCall(StrimzSubscriptions.initialize, (admin_, r, f, t));
        return StrimzSubscriptions(ProxyDeploy.deploy(address(impl), data));
    }

    function _deployAgentRegistry(address admin_) internal returns (StrimzAgentRegistry) {
        StrimzAgentRegistry impl = new StrimzAgentRegistry();
        bytes memory data = abi.encodeCall(StrimzAgentRegistry.initialize, (admin_));
        return StrimzAgentRegistry(ProxyDeploy.deploy(address(impl), data));
    }

    function _deployAgentEscrow(address admin_, ITokenWhitelist t)
        internal
        returns (StrimzAgentEscrow)
    {
        StrimzAgentEscrow impl = new StrimzAgentEscrow();
        bytes memory data = abi.encodeCall(StrimzAgentEscrow.initialize, (admin_, t));
        return StrimzAgentEscrow(ProxyDeploy.deploy(address(impl), data));
    }
}
