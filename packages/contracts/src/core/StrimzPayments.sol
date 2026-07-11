// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IStrimzPayments } from "../interfaces/IStrimzPayments.sol";
import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { IERC3009 } from "../interfaces/IERC3009.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzPayments
/// @notice One-shot payments. `pay` for classic ERC20 approve+pull;
///         `payWithAuthorization` for the EIP-3009 meta-tx flow.
/// @dev    Immutable. No proxy, no upgrade. Bugs mean redeploy + Registry
///         pointer rotation.
contract StrimzPayments is IStrimzPayments, StrimzPausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Mirrors TokenWhitelist.CAP_TRANSFER_AUTH_3009.
    uint8 private constant CAP_TRANSFER_AUTH_3009 = 1 << 1; // 0x02

    /// @dev The payer signs this alongside the EIP-3009 auth. Binds
    ///      every parameter that decides where the money goes so an
    ///      attacker holding the EIP-3009 sig can't redirect the
    ///      payment to a different merchant.
    bytes32 private constant PAY_INTENT_TYPEHASH = keccak256(
        "PayIntent(uint256 merchantId,address token,uint256 amount,bytes32 nonce,uint256 validBefore,bytes32 ref)"
    );

    /// @custom:storage-location erc7201:strimz.storage.StrimzPayments
    struct Storage {
        IStrimzRegistry registry;
        IFeeCollector feeCollector;
        ITokenWhitelist tokenWhitelist;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.StrimzPayments")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0x014cd36c4d3c0caf0ede105cfbe63430493b6014d881c749f2e0dc422bcd6f00;

    event DependencyUpdated(string name, address newAddress);

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /// @dev Single-phase init. The `initializer` modifier guards OZ's
    ///      `__init` calls; `_disableInitializers` is unnecessary
    ///      because this contract is not behind a proxy.
    constructor(
        address admin,
        IStrimzRegistry registry_,
        IFeeCollector feeCollector_,
        ITokenWhitelist tokenWhitelist_
    ) EIP712("StrimzPayments", "1") initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        Storage storage $ = _s();
        $.registry = registry_;
        $.feeCollector = feeCollector_;
        $.tokenWhitelist = tokenWhitelist_;
    }

    // ----- Dependency views -----

    function registry() external view returns (IStrimzRegistry) { return _s().registry; }
    function feeCollector() external view returns (IFeeCollector) { return _s().feeCollector; }
    function tokenWhitelist() external view returns (ITokenWhitelist) { return _s().tokenWhitelist; }

    // ----- Dependency rotation -----

    /// @dev Dependency rotation is only permitted while paused. Blocks a
    ///      compromised admin from hot-swapping a live money-mover to a
    ///      malicious registry / fee collector in the middle of a block.
    ///      Legitimate operator flow: pause → rotate → unpause.

    function setRegistry(IStrimzRegistry v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Payments__InvalidAmount();
        _s().registry = v;
        emit DependencyUpdated("registry", address(v));
    }

    function setFeeCollector(IFeeCollector v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Payments__InvalidAmount();
        _s().feeCollector = v;
        emit DependencyUpdated("feeCollector", address(v));
    }

    function setTokenWhitelist(ITokenWhitelist v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Payments__InvalidAmount();
        _s().tokenWhitelist = v;
        emit DependencyUpdated("tokenWhitelist", address(v));
    }

    // ----- Core flow -----

    /// @inheritdoc IStrimzPayments
    function pay(uint256 merchantId, address token, uint256 amount, bytes32 ref)
        external
        override
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert Payments__InvalidAmount();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Payments__InvalidToken(token);

        IStrimzRegistry.Merchant memory m = $.registry.requireActiveMerchant(merchantId);

        uint256 feeAmount;
        unchecked {
            // feeBps ≤ 500 and amount < 2^247 in any realistic scenario.
            feeAmount = (amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = amount - feeAmount;

        if (feeAmount > 0) {
            _exactTransferFrom(IERC20(token), msg.sender, address($.feeCollector), feeAmount);
            $.feeCollector.accrue(token, merchantId, feeAmount);
        }
        _exactTransferFrom(IERC20(token), msg.sender, m.payoutAddress, netAmount);

        emit PaymentExecuted(merchantId, msg.sender, token, amount, feeAmount, netAmount, ref);
    }

    /// @inheritdoc IStrimzPayments
    function payWithAuthorization(
        uint256 merchantId,
        address token,
        PayAuthorization calldata auth,
        bytes32 ref,
        Sig calldata authSig,
        Sig calldata intentSig
    ) external override whenNotPaused nonReentrant {
        if (auth.amount == 0) revert Payments__InvalidAmount();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Payments__InvalidToken(token);
        if (!$.tokenWhitelist.supportsCapability(token, CAP_TRANSFER_AUTH_3009)) {
            revert Payments__UnsupportedCapability(token);
        }

        // Verify the Strimz intent BEFORE calling the token. Cheap fail
        // path — the intent binds every param that decides fund routing.
        _verifyPayIntent(merchantId, token, auth, ref, intentSig);

        IStrimzRegistry.Merchant memory m = $.registry.requireActiveMerchant(merchantId);

        // Pull the gross to this contract. The token verifies the sig,
        // checks the validity window, and burns the nonce.
        uint256 beforeSelf = IERC20(token).balanceOf(address(this));
        IERC3009(token).receiveWithAuthorization(
            auth.from,
            address(this),
            auth.amount,
            auth.validAfter,
            auth.validBefore,
            auth.nonce,
            authSig.v, authSig.r, authSig.s
        );
        // Fee-on-transfer / rebase check: this contract must have
        // received exactly auth.amount.
        if (IERC20(token).balanceOf(address(this)) - beforeSelf != auth.amount) {
            revert Payments__NonStandardTransfer();
        }

        uint256 feeAmount;
        unchecked {
            feeAmount = (auth.amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = auth.amount - feeAmount;

        if (feeAmount > 0) {
            _exactTransfer(IERC20(token), address($.feeCollector), feeAmount);
            $.feeCollector.accrue(token, merchantId, feeAmount);
        }
        _exactTransfer(IERC20(token), m.payoutAddress, netAmount);

        emit PaymentExecuted(merchantId, auth.from, token, auth.amount, feeAmount, netAmount, ref);
    }

    /// @dev Balance-delta guard around `safeTransferFrom`. If the token
    ///      delivers less than requested (fee-on-transfer, rebasing,
    ///      blocklist-in-flight), revert the whole call.
    function _exactTransferFrom(IERC20 token, address from, address to, uint256 amount) private {
        uint256 before = token.balanceOf(to);
        token.safeTransferFrom(from, to, amount);
        if (token.balanceOf(to) - before != amount) revert Payments__NonStandardTransfer();
    }

    /// @dev Balance-delta guard around `safeTransfer`.
    function _exactTransfer(IERC20 token, address to, uint256 amount) private {
        uint256 before = token.balanceOf(to);
        token.safeTransfer(to, amount);
        if (token.balanceOf(to) - before != amount) revert Payments__NonStandardTransfer();
    }

    /// @dev Recovers the intent signer via EIP-712 and requires it to
    ///      match `auth.from` — the same key that signed the EIP-3009
    ///      authorization must also authorise the Strimz routing.
    function _verifyPayIntent(
        uint256 merchantId,
        address token,
        PayAuthorization calldata auth,
        bytes32 ref,
        Sig calldata intentSig
    ) internal view {
        bytes32 structHash = keccak256(abi.encode(
            PAY_INTENT_TYPEHASH,
            merchantId,
            token,
            auth.amount,
            auth.nonce,
            auth.validBefore,
            ref
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, intentSig.v, intentSig.r, intentSig.s);
        if (recovered != auth.from) revert Payments__InvalidIntent();
    }

    /// @notice Exposed so off-chain SDKs can derive the same digest
    ///         they need to sign.
    function payIntentDigest(
        uint256 merchantId,
        address token,
        uint256 amount,
        bytes32 nonce,
        uint256 validBefore,
        bytes32 ref
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            PAY_INTENT_TYPEHASH,
            merchantId,
            token,
            amount,
            nonce,
            validBefore,
            ref
        ));
        return _hashTypedDataV4(structHash);
    }
}
