// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IStrimzPayments } from "../interfaces/IStrimzPayments.sol";
import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { IERC3009 } from "../interfaces/IERC3009.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzPayments
/// @notice One-shot USDC / EURC payments with fee-on-transfer split and
///         pull-based ERC20 settlement. Two entrypoints:
///         - `pay()` — classic approve+pay flow for any whitelisted token.
///         - `payWithAuthorization()` — EIP-3009 meta-tx flow for tokens
///           whose `TokenWhitelist` capability bitmap has `CAP_TRANSFER_AUTH_3009`.
/// @dev    **This contract is immutable.** It does NOT inherit
///         `UUPSUpgradeable` and has no `_authorizeUpgrade` function. If
///         a vulnerability is discovered, the remediation is to deploy a
///         new `StrimzPayments` to a fresh address and rotate the
///         Registry's dependency pointers. This is the deliberate
///         security posture documented in the Strimz whitepaper —
///         policy-bearing contracts (Registry, FeeCollector,
///         TokenWhitelist) remain upgradeable, but the value-moving
///         path is closed against upgrade-as-attack-vector.
/// @dev    Dependency references live in namespaced storage so the
///         admin can still rotate them via `setRegistry` /
///         `setFeeCollector` / `setTokenWhitelist`.
contract StrimzPayments is IStrimzPayments, StrimzPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Mirrors `TokenWhitelist.CAP_TRANSFER_AUTH_3009`. If the bit
    ///      assignment in TokenWhitelist ever changes, update this
    ///      constant in lockstep. Cheaper than reading via the interface
    ///      on every call.
    uint8 private constant CAP_TRANSFER_AUTH_3009 = 1 << 1; // 0x02

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

    /// @dev Single-phase init. The `initializer` modifier from OZ's
    ///      Initializable guards the OZ `__init` functions and prevents
    ///      double-initialisation. Because this contract is non-upgradeable
    ///      and never sits behind a proxy, the `_disableInitializers`
    ///      pattern (used by the upgradeable contracts) is unnecessary.
    constructor(
        address admin,
        IStrimzRegistry registry_,
        IFeeCollector feeCollector_,
        ITokenWhitelist tokenWhitelist_
    ) initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        // UPGRADER_ROLE is not granted here — there is nothing to upgrade.
        // The role still exists in StrimzAccessControl (it's used by the
        // upgradeable contracts), but `StrimzPayments` simply never
        // consults it because there is no `_authorizeUpgrade` function.

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

    function setRegistry(IStrimzRegistry v) external onlyRole(ADMIN_ROLE) {
        _s().registry = v;
        emit DependencyUpdated("registry", address(v));
    }

    function setFeeCollector(IFeeCollector v) external onlyRole(ADMIN_ROLE) {
        _s().feeCollector = v;
        emit DependencyUpdated("feeCollector", address(v));
    }

    function setTokenWhitelist(ITokenWhitelist v) external onlyRole(ADMIN_ROLE) {
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
            // feeBps <= MAX_FEE_BPS (500); amount * 500 cannot overflow for
            // any realistic `amount` < 2^247. Safe under Solidity 0.8.
            feeAmount = (amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = amount - feeAmount;

        // Payer → FeeCollector (fee)
        if (feeAmount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address($.feeCollector), feeAmount);
            $.feeCollector.accrue(token, merchantId, feeAmount);
        }
        // Payer → Merchant (net)
        IERC20(token).safeTransferFrom(msg.sender, m.payoutAddress, netAmount);

        emit PaymentExecuted(merchantId, msg.sender, token, amount, feeAmount, netAmount, ref);
    }

    /// @inheritdoc IStrimzPayments
    function payWithAuthorization(
        uint256 merchantId,
        address token,
        PayAuthorization calldata auth,
        bytes32 ref,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override whenNotPaused nonReentrant {
        if (auth.amount == 0) revert Payments__InvalidAmount();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Payments__InvalidToken(token);
        // The token must declare EIP-3009 support; we don't want a relayer
        // to accidentally call a non-3009 token's fallback function with
        // these arguments and have something unintended happen.
        if (!$.tokenWhitelist.supportsCapability(token, CAP_TRANSFER_AUTH_3009)) {
            revert Payments__UnsupportedCapability(token);
        }

        IStrimzRegistry.Merchant memory m = $.registry.requireActiveMerchant(merchantId);

        // Pull the full amount into this contract via EIP-3009. The token
        // verifies the signature and the validity window, enforces that
        // msg.sender == to (this contract), and records the nonce as used
        // so the same authorization cannot be replayed. Any failure
        // (bad signature, expired window, replayed nonce) reverts the
        // entire payWithAuthorization call atomically.
        IERC3009(token).receiveWithAuthorization(
            auth.from,
            address(this),
            auth.amount,
            auth.validAfter,
            auth.validBefore,
            auth.nonce,
            v, r, s
        );

        uint256 feeAmount;
        unchecked {
            // Same overflow reasoning as pay(): feeBps <= MAX_FEE_BPS (500),
            // auth.amount < 2^247 in any realistic scenario, so the product
            // cannot overflow under Solidity 0.8.
            feeAmount = (auth.amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = auth.amount - feeAmount;

        // The funds are now in address(this). Forward them: fee to the
        // FeeCollector, net to the merchant's payout address. SafeERC20
        // handles non-standard tokens that return false instead of
        // reverting on failure.
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(address($.feeCollector), feeAmount);
            $.feeCollector.accrue(token, merchantId, feeAmount);
        }
        IERC20(token).safeTransfer(m.payoutAddress, netAmount);

        emit PaymentExecuted(merchantId, auth.from, token, auth.amount, feeAmount, netAmount, ref);
    }
}
