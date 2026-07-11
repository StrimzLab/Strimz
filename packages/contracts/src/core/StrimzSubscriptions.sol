// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IStrimzSubscriptions } from "../interfaces/IStrimzSubscriptions.sol";
import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { IFeeCollector } from "../interfaces/IFeeCollector.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { IERC2612 } from "../interfaces/IERC2612.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzSubscriptions
/// @notice Recurring stablecoin billing. Enrol with `createSubscription`
///         (approve + create) or `permitAndCreateSubscription` (EIP-2612
///         single-signature). Charged in batches by the scheduler; every
///         per-row failure surfaces as a ChargeOutcome instead of
///         reverting the batch.
/// @dev    Immutable. No proxy, no upgrade. Bugs mean redeploy + Registry
///         pointer rotation.
contract StrimzSubscriptions is IStrimzSubscriptions, StrimzPausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint32 public constant MIN_INTERVAL = 1 hours;
    uint256 public constant MAX_MERCHANT_ID = type(uint96).max;
    /// @notice Hard cap on batch size. Scheduler chunks to 200; 500
    ///         keeps a safety margin below block gas.
    uint256 public constant MAX_BATCH_SIZE = 500;

    /// @dev Mirrors TokenWhitelist.CAP_PERMIT_2612.
    uint8 private constant CAP_PERMIT_2612 = 1 << 0; // 0x01

    /// @dev Signed by the payer alongside the ERC-2612 permit. Binds
    ///      every subscription parameter to the specific permit so a
    ///      valid permit alone cannot enrol the payer in an arbitrary
    ///      subscription.
    bytes32 private constant SUBSCRIPTION_INTENT_TYPEHASH = keccak256(
        "SubscriptionIntent(uint256 merchantId,address token,uint256 amount,uint32 interval,uint64 startAt,uint64 endAt,uint256 permitDeadline)"
    );

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

    error Subscriptions__BatchTooLarge(uint256 provided, uint256 max);
    error Subscriptions__ZeroAddress();
    error Subscriptions__OnlySelf();
    error Subscriptions__NonStandardTransfer();

    event DependencyUpdated(string name, address newAddress);

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    constructor(
        address admin,
        IStrimzRegistry registry_,
        IFeeCollector feeCollector_,
        ITokenWhitelist tokenWhitelist_
    ) EIP712("StrimzSubscriptions", "1") initializer {
        if (
            admin == address(0)
                || address(registry_) == address(0)
                || address(feeCollector_) == address(0)
                || address(tokenWhitelist_) == address(0)
        ) revert Subscriptions__ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(CHARGER_ROLE, admin);

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

    /// @dev Rotation only while paused — a compromised admin cannot
    ///      hot-swap dependencies against a live subscription flow.

    function setRegistry(IStrimzRegistry v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Subscriptions__ZeroAddress();
        _s().registry = v;
        emit DependencyUpdated("registry", address(v));
    }

    function setFeeCollector(IFeeCollector v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Subscriptions__ZeroAddress();
        _s().feeCollector = v;
        emit DependencyUpdated("feeCollector", address(v));
    }

    function setTokenWhitelist(ITokenWhitelist v) external onlyRole(ADMIN_ROLE) whenPaused {
        if (address(v) == address(0)) revert Subscriptions__ZeroAddress();
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
        IStrimzSubscriptions.Sig calldata permitSig,
        IStrimzSubscriptions.Sig calldata intentSig
    ) external override whenNotPaused returns (uint256 subscriptionId) {
        if (amount == 0) revert Subscriptions__InvalidAmount();
        if (interval < MIN_INTERVAL) revert Subscriptions__InvalidInterval();
        if (merchantId > MAX_MERCHANT_ID) revert Subscriptions__InvalidMerchantId();

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert Subscriptions__InvalidToken(token);
        if (!$.tokenWhitelist.supportsCapability(token, CAP_PERMIT_2612)) {
            revert Subscriptions__UnsupportedCapability(token);
        }
        $.registry.requireActiveMerchant(merchantId);

        // Verify the Strimz intent BEFORE calling permit — a bad intent
        // must not consume the permit's nonce on the token.
        _verifySubscriptionIntent(
            merchantId, token, amount, interval, startAt, endAt, permitData, intentSig
        );

        IERC2612(token).permit(
            permitData.owner,
            address(this),
            permitData.value,
            permitData.deadline,
            permitSig.v, permitSig.r, permitSig.s
        );

        uint64 firstChargeAt = startAt == 0 ? uint64(block.timestamp) : startAt;
        if (endAt != 0 && endAt <= firstChargeAt) revert Subscriptions__InvalidEndAt();

        subscriptionId = $.nextSubscriptionId;
        unchecked {
            $.nextSubscriptionId = subscriptionId + 1;
        }
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

    /// @dev Recovers the intent signer and requires it to equal
    ///      `permitData.owner`. Same key must authorise both the token
    ///      allowance and the subscription parameters.
    function _verifySubscriptionIntent(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        PermitData calldata permitData,
        IStrimzSubscriptions.Sig calldata intentSig
    ) internal view {
        bytes32 structHash = keccak256(abi.encode(
            SUBSCRIPTION_INTENT_TYPEHASH,
            merchantId,
            token,
            amount,
            interval,
            startAt,
            endAt,
            permitData.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, intentSig.v, intentSig.r, intentSig.s);
        if (recovered != permitData.owner) revert Subscriptions__InvalidIntent();
    }

    /// @notice Exposed so off-chain SDKs can derive the same digest they
    ///         need to sign.
    function subscriptionIntentDigest(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        uint256 permitDeadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            SUBSCRIPTION_INTENT_TYPEHASH,
            merchantId,
            token,
            amount,
            interval,
            startAt,
            endAt,
            permitDeadline
        ));
        return _hashTypedDataV4(structHash);
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
    /// @dev No per-row error reverts the batch. Every failure returns
    ///      a ChargeOutcome instead.
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
        if (n > MAX_BATCH_SIZE) revert Subscriptions__BatchTooLarge(n, MAX_BATCH_SIZE);
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
        // Idempotency. An attempt id is spent on first use even if the
        // downstream check fails; retries need a fresh id.
        if ($.usedAttempts[chargeAttemptId]) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Duplicate);
            return ChargeOutcome.Duplicate;
        }
        $.usedAttempts[chargeAttemptId] = true;

        Subscription storage sub = $.subscriptions[subscriptionId];
        if (sub.payer == address(0)) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Unknown);
            return ChargeOutcome.Unknown;
        }

        if (sub.cancelled) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Cancelled);
            return ChargeOutcome.Cancelled;
        }
        if (block.timestamp < sub.nextChargeAt) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.NotDue);
            return ChargeOutcome.NotDue;
        }
        if (sub.endAt != 0 && block.timestamp >= sub.endAt) {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.Ended);
            return ChargeOutcome.Ended;
        }

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

        // Wrapped so an admin freezing a merchant mid-batch doesn't lose
        // the rest of the batch.
        IStrimzRegistry.Merchant memory m;
        try $.registry.requireActiveMerchant(sub.merchantId) returns (IStrimzRegistry.Merchant memory _m) {
            m = _m;
        } catch {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.MerchantInactive);
            return ChargeOutcome.MerchantInactive;
        }

        uint256 feeAmount;
        unchecked {
            feeAmount = (amount * m.feeBps) / BPS_DENOMINATOR;
        }
        uint256 netAmount = amount - feeAmount;

        // Self-external call so a token transfer revert (Circle
        // blocklist, rogue token) surfaces as an outcome instead of
        // unwinding the whole batch.
        try this._settleCharge(
            payer,
            token,
            address($.feeCollector),
            sub.merchantId,
            feeAmount,
            m.payoutAddress,
            netAmount
        ) {
            unchecked {
                // Advance one period only. A scheduler outage silently
                // drops missed periods — we bias predictable billing
                // over surprise multi-charges.
                sub.nextChargeAt += sub.interval;
            }
            emit SubscriptionCharged(subscriptionId, chargeAttemptId, amount, feeAmount, netAmount, sub.nextChargeAt);
            return ChargeOutcome.Charged;
        } catch {
            emit SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, ChargeOutcome.TransferFailed);
            return ChargeOutcome.TransferFailed;
        }
    }

    /// @notice Called only by `_charge` under try/catch. External so we
    ///         can catch its reverts without unwinding the outer batch.
    /// @dev    Balance-delta check on each leg — fee-on-transfer tokens
    ///         make actual delivery drift from what's booked. Reject
    ///         instead of silently accepting a partial payment.
    function _settleCharge(
        address payer,
        IERC20 token,
        address feeCollectorAddr,
        uint256 merchantId,
        uint256 feeAmount,
        address payoutAddr,
        uint256 netAmount
    ) external {
        if (msg.sender != address(this)) revert Subscriptions__OnlySelf();
        if (feeAmount > 0) {
            uint256 fBefore = token.balanceOf(feeCollectorAddr);
            token.safeTransferFrom(payer, feeCollectorAddr, feeAmount);
            if (token.balanceOf(feeCollectorAddr) - fBefore != feeAmount) {
                revert Subscriptions__NonStandardTransfer();
            }
            IFeeCollector(feeCollectorAddr).accrue(address(token), merchantId, feeAmount);
        }
        uint256 mBefore = token.balanceOf(payoutAddr);
        token.safeTransferFrom(payer, payoutAddr, netAmount);
        if (token.balanceOf(payoutAddr) - mBefore != netAmount) {
            revert Subscriptions__NonStandardTransfer();
        }
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
