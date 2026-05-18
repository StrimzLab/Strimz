// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IStrimzSubscriptions } from "../interfaces/IStrimzSubscriptions.sol";
import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { IERC2612 } from "../interfaces/IERC2612.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzSubscriptions
/// @notice Recurring USDC / EURC billing with contract-level idempotency.
///         Two enrolment entrypoints:
///         - `createSubscription` — classic approve+create flow.
///         - `permitAndCreateSubscription` — EIP-2612 single-signature
///           enrolment for tokens with `CAP_PERMIT_2612` set on
///           TokenWhitelist.
/// @dev    **This contract is immutable.** Same security posture as
///         `StrimzPayments`: no `UUPSUpgradeable`, no `_authorizeUpgrade`.
///         A discovered bug triggers redeploy + Registry pointer rotation,
///         not in-place upgrade. The trade-off is documented in the
///         Strimz whitepaper Section 4.3.
contract StrimzSubscriptions is IStrimzSubscriptions, StrimzPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint32 public constant MIN_INTERVAL = 1 hours;
    uint256 public constant MAX_MERCHANT_ID = type(uint96).max;

    /// @dev Mirrors `TokenWhitelist.CAP_PERMIT_2612`. If the bit
    ///      assignment in TokenWhitelist ever changes, update this
    ///      constant in lockstep.
    uint8 private constant CAP_PERMIT_2612 = 1 << 0; // 0x01

    /// @custom:storage-location erc7201:strimz.storage.StrimzSubscriptions
    struct Storage {
        IStrimzRegistry registry;
        IFeeCollector feeCollector;
        ITokenWhitelist tokenWhitelist;
        uint256 nextSubscriptionId;
        mapping(uint256 subscriptionId => Subscription data) subscriptions;
        mapping(bytes32 chargeAttemptId => bool used) usedAttempts;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.StrimzSubscriptions")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0x0367d7d30481502848b36438ae11253600da0cf9a855e998795b9d9352001500;

    event DependencyUpdated(string name, address newAddress);

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /// @dev See `StrimzPayments` for the rationale on single-phase
    ///      constructor init in a non-upgradeable contract that still
    ///      uses OZ's *Upgradeable abstract base classes.
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
        _grantRole(CHARGER_ROLE, admin);
        // UPGRADER_ROLE deliberately omitted — there is nothing to upgrade.

        Storage storage $ = _s();
        $.registry = registry_;
        $.feeCollector = feeCollector_;
        $.tokenWhitelist = tokenWhitelist_;
        $.nextSubscriptionId = 1;
    }

    // ----- Dependency views + rotation -----

    function registry() external view returns (IStrimzRegistry) { return _s().registry; }
    function feeCollector() external view returns (IFeeCollector) { return _s().feeCollector; }
    function tokenWhitelist() external view returns (ITokenWhitelist) { return _s().tokenWhitelist; }

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

    /// @inheritdoc IStrimzSubscriptions
    function createSubscription(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt
    ) external override whenNotPaused returns (uint256 subscriptionId) {
        if (amount == 0) revert Subscriptions__InvalidAmount();
        if (interval < MIN_INTERVAL) revert Subscriptions__InvalidInterval();
        if (merchantId > MAX_MERCHANT_ID) revert Subscriptions__InvalidMerchantId();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Subscriptions__InvalidToken(token);
        $.registry.requireActiveMerchant(merchantId);

        uint64 firstChargeAt = startAt == 0 ? uint64(block.timestamp) : startAt;
        // endAt=0 → open-ended. Otherwise it must come after the first
        // charge — a subscription that ends before it begins is meaningless.
        if (endAt != 0 && endAt <= firstChargeAt) revert Subscriptions__InvalidEndAt();

        subscriptionId = $.nextSubscriptionId;
        unchecked {
            $.nextSubscriptionId = subscriptionId + 1;
        }
        $.subscriptions[subscriptionId] = Subscription({
            payer: msg.sender,
            nextChargeAt: firstChargeAt,
            interval: interval,
            token: token,
            merchantId: uint96(merchantId),
            amount: amount,
            endAt: endAt,
            cancelled: false
        });

        emit SubscriptionCreated(subscriptionId, merchantId, msg.sender, token, amount, interval, firstChargeAt);
    }

    /// @inheritdoc IStrimzSubscriptions
    function permitAndCreateSubscription(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        PermitData calldata permitData,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override whenNotPaused returns (uint256 subscriptionId) {
        if (amount == 0) revert Subscriptions__InvalidAmount();
        if (interval < MIN_INTERVAL) revert Subscriptions__InvalidInterval();
        if (merchantId > MAX_MERCHANT_ID) revert Subscriptions__InvalidMerchantId();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Subscriptions__InvalidToken(token);
        // The token must declare EIP-2612 support; calling `permit()` on
        // a token that doesn't implement it would either revert with no
        // useful error or, worse, silently no-op on a non-standard fallback.
        if (!$.tokenWhitelist.supportsCapability(token, CAP_PERMIT_2612)) {
            revert Subscriptions__UnsupportedCapability(token);
        }
        $.registry.requireActiveMerchant(merchantId);

        // Set the allowance via permit. The token verifies the signature
        // came from `permitData.owner`, that the deadline hasn't passed,
        // and that the owner's permit nonce hasn't been consumed. Any of
        // those failures revert atomically — the subscription is not
        // created on a bad permit.
        IERC2612(token).permit(
            permitData.owner,
            address(this),
            permitData.value,
            permitData.deadline,
            v, r, s
        );

        uint64 firstChargeAt = startAt == 0 ? uint64(block.timestamp) : startAt;
        if (endAt != 0 && endAt <= firstChargeAt) revert Subscriptions__InvalidEndAt();

        subscriptionId = $.nextSubscriptionId;
        unchecked {
            $.nextSubscriptionId = subscriptionId + 1;
        }
        // `payer` is the permit owner, not `msg.sender`. This enables the
        // meta-tx pattern: a relayer can call this function on behalf of
        // a customer who only ever signed a permit message. Cancellation
        // remains the customer's right because `cancel()` checks
        // `msg.sender == sub.payer`, not the creator of the subscription.
        $.subscriptions[subscriptionId] = Subscription({
            payer: permitData.owner,
            nextChargeAt: firstChargeAt,
            interval: interval,
            token: token,
            merchantId: uint96(merchantId),
            amount: amount,
            endAt: endAt,
            cancelled: false
        });

        emit SubscriptionCreated(
            subscriptionId, merchantId, permitData.owner, token, amount, interval, firstChargeAt
        );
    }

    /// @inheritdoc IStrimzSubscriptions
    function cancel(uint256 subscriptionId) external override {
        Storage storage $ = _s();
        Subscription storage sub = $.subscriptions[subscriptionId];
        if (sub.payer == address(0)) revert Subscriptions__UnknownSubscription(subscriptionId);

        IStrimzRegistry.Merchant memory m = $.registry.getMerchant(sub.merchantId);
        if (msg.sender != sub.payer && msg.sender != m.owner) revert Subscriptions__NotSubscriptionParty();

        sub.cancelled = true;
        emit SubscriptionCancelled(subscriptionId, msg.sender);
    }

    /// @inheritdoc IStrimzSubscriptions
    function batchCharge(uint256[] calldata subscriptionIds, bytes32[] calldata chargeAttemptIds)
        external
        override
        whenNotPaused
        onlyRole(CHARGER_ROLE)
        nonReentrant
        returns (ChargeOutcome[] memory outcomes)
    {
        uint256 n = subscriptionIds.length;
        if (n != chargeAttemptIds.length) revert Subscriptions__LengthMismatch();
        outcomes = new ChargeOutcome[](n);
        Storage storage $ = _s();
        for (uint256 i; i < n;) {
            outcomes[i] = _charge($, subscriptionIds[i], chargeAttemptIds[i]);
            unchecked { ++i; }
        }
    }

    function _charge(Storage storage $, uint256 subscriptionId, bytes32 chargeAttemptId)
        private
        returns (ChargeOutcome)
    {
        if ($.usedAttempts[chargeAttemptId]) revert Subscriptions__DuplicateAttempt(chargeAttemptId);
        $.usedAttempts[chargeAttemptId] = true;

        Subscription storage sub = $.subscriptions[subscriptionId];
        if (sub.payer == address(0)) revert Subscriptions__UnknownSubscription(subscriptionId);

        if (sub.cancelled) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Cancelled);
            return ChargeOutcome.Cancelled;
        }
        if (block.timestamp < sub.nextChargeAt) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.NotDue);
            return ChargeOutcome.NotDue;
        }
        // endAt=0 means open-ended. Otherwise once block.timestamp reaches
        // endAt, no further charges fire — even if the customer's allowance
        // and balance are sufficient. This is the "subscribe for 12 months"
        // primitive the merchant configures at create time.
        if (sub.endAt != 0 && block.timestamp >= sub.endAt) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Ended);
            return ChargeOutcome.Ended;
        }

        // Cache hot fields in locals to avoid repeated SLOADs.
        address payer = sub.payer;
        uint256 amount = sub.amount;
        IERC20 token = IERC20(sub.token);

        if (token.allowance(payer, address(this)) < amount) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.RevokedApproval);
            return ChargeOutcome.RevokedApproval;
        }
        if (token.balanceOf(payer) < amount) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.InsufficientFunds);
            return ChargeOutcome.InsufficientFunds;
        }

        IStrimzRegistry.Merchant memory m = $.registry.requireActiveMerchant(sub.merchantId);
        uint256 feeAmount;
        unchecked {
            feeAmount = (amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = amount - feeAmount;

        if (feeAmount > 0) {
            token.safeTransferFrom(payer, address($.feeCollector), feeAmount);
            $.feeCollector.accrue(address(token), sub.merchantId, feeAmount);
        }
        token.safeTransferFrom(payer, m.payoutAddress, netAmount);

        unchecked {
            sub.nextChargeAt += sub.interval;
        }

        emit SubscriptionCharged(subscriptionId, chargeAttemptId, amount, feeAmount, netAmount, sub.nextChargeAt);
        return ChargeOutcome.Charged;
    }

    /// @inheritdoc IStrimzSubscriptions
    function getSubscription(uint256 subscriptionId) external view override returns (Subscription memory) {
        return _s().subscriptions[subscriptionId];
    }

    /// @inheritdoc IStrimzSubscriptions
    function isAttemptUsed(bytes32 chargeAttemptId) external view override returns (bool) {
        return _s().usedAttempts[chargeAttemptId];
    }
}
