// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

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

/// @dev Mock USDC for tests. Mirrors the real-world USDC surface that
///      Strimz contracts rely on: 6 decimals, EIP-2612 `permit` (via
///      OZ's ERC20Permit), and EIP-3009 `receiveWithAuthorization`.
///      Both authorization paths share the EIP-712 domain separator
///      that ERC20Permit's constructor sets up, so off-chain signers
///      only need to read `DOMAIN_SEPARATOR()` once.
contract MockUsdc is ERC20Permit {
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    mapping(address authorizer => mapping(bytes32 nonce => bool used)) private _authorizationStates;

    error MockUsdc__AuthorizationExpired();
    error MockUsdc__AuthorizationNotYetValid();
    error MockUsdc__AuthorizationAlreadyUsed();
    error MockUsdc__InvalidSignature();
    error MockUsdc__CallerNotPayee();

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("Mock USDC", "mUSDC") ERC20Permit("Mock USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /// @dev Faithful EIP-3009 implementation: `to` MUST equal `msg.sender`
    ///      (front-running protection), validity window is half-open
    ///      `(validAfter, validBefore)`, and nonces are single-use.
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
    ) external {
        if (to != msg.sender) revert MockUsdc__CallerNotPayee();
        if (block.timestamp <= validAfter) revert MockUsdc__AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert MockUsdc__AuthorizationExpired();
        if (_authorizationStates[from][nonce]) revert MockUsdc__AuthorizationAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != from) revert MockUsdc__InvalidSignature();

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }
}

/// @dev Base test harness — provides labelled actors, a mock USDC, and
///      proxy-deploy helpers for every Strimz contract.
abstract contract StrimzTestBase is Test {
    address internal admin;
    address internal merchant;
    address internal merchantPayout;
    /// @dev `payer` is initialized via `makeAddrAndKey` so signature-based
    ///      tests can sign with `payerPk` while keeping the legacy
    ///      `vm.prank(payer)` flow unchanged (same address either way).
    address internal payer;
    uint256 internal payerPk;
    address internal vendor;
    address internal assessor;
    address internal treasury;

    MockUsdc internal usdc;

    constructor() {
        admin = makeAddr("admin");
        merchant = makeAddr("merchant");
        merchantPayout = makeAddr("merchantPayout");
        (payer, payerPk) = makeAddrAndKey("payer");
        vendor = makeAddr("vendor");
        assessor = makeAddr("assessor");
        treasury = makeAddr("treasury");
    }

    function _setUpTokens() internal {
        usdc = new MockUsdc();
    }

    function _fund(address to, uint256 amount) internal {
        usdc.mint(to, amount);
    }

    // ----- EIP-712 signing helpers (test-only) -----

    /// @dev Produces a signer signature over an EIP-3009
    ///      `ReceiveWithAuthorization` message for the given token.
    function _signReceiveWithAuthorization(
        MockUsdc token,
        uint256 signerPk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(signerPk, digest);
    }

    /// @dev Produces an EIP-2612 `Permit` signature for the given token.
    ///      Reads the owner's permit nonce so successive calls in a test
    ///      produce valid messages.
    function _signPermit(
        MockUsdc token,
        uint256 signerPk,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 permitTypehash = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(permitTypehash, owner, spender, value, token.nonces(owner), deadline)
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(signerPk, digest);
    }

    /// @dev Sign a Strimz PayIntent for `StrimzPayments`. The
    ///      contract's `payIntentDigest` is authoritative; we hit it
    ///      directly so the test tracks the on-chain hashing exactly.
    function _signPayIntent(
        StrimzPayments payments,
        uint256 signerPk,
        uint256 merchantId,
        address token,
        uint256 amount,
        bytes32 nonce,
        uint256 validBefore,
        bytes32 ref
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 digest = payments.payIntentDigest(merchantId, token, amount, nonce, validBefore, ref);
        (v, r, s) = vm.sign(signerPk, digest);
    }

    /// @dev Sign a Strimz SubscriptionIntent for `StrimzSubscriptions`.
    function _signSubscriptionIntent(
        StrimzSubscriptions subs,
        uint256 signerPk,
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        uint256 permitDeadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 digest = subs.subscriptionIntentDigest(
            merchantId, token, amount, interval, startAt, endAt, permitDeadline
        );
        (v, r, s) = vm.sign(signerPk, digest);
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

    /// @dev Payments and Subscriptions are non-upgradeable — they deploy
    ///      directly with a constructor, no proxy. See the contracts'
    ///      natspec for the security rationale.
    function _deployPayments(
        address admin_,
        IStrimzRegistry r,
        IFeeCollector f,
        ITokenWhitelist t
    ) internal returns (StrimzPayments) {
        return new StrimzPayments(admin_, r, f, t);
    }

    function _deploySubscriptions(
        address admin_,
        IStrimzRegistry r,
        IFeeCollector f,
        ITokenWhitelist t
    ) internal returns (StrimzSubscriptions) {
        return new StrimzSubscriptions(admin_, r, f, t);
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
