// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzSubscriptions
/// @notice Recurring payments. The payer sets an ERC20 allowance; the
///         Strimz scheduler calls `batchCharge` with idempotent charge
///         attempt ids once per billing period.
interface IStrimzSubscriptions {
    /// @dev Layout packed to minimise SLOADs on the hot charge path:
    ///        slot 0: payer (160) + nextChargeAt (64) + interval (32)   → 256 ✓
    ///        slot 1: token (160) + merchantId (96)                     → 256 ✓
    ///        slot 2: amount (256)
    ///        slot 3: cancelled (1 byte) — solo
    ///      merchantId uses uint96 (≈7.9×10²⁸ merchants — far more than
    ///      will ever exist).
    struct Subscription {
        address payer;
        uint64 nextChargeAt;
        uint32 interval;
        address token;
        uint96 merchantId;
        uint256 amount;
        bool cancelled;
    }

    /// @dev `None` MUST remain the first variant so that the default (zero)
    ///      value of an uninitialised storage slot is never a valid outcome.
    ///      Treating an unset enum as `Charged` would cause silent fund loss.
    enum ChargeOutcome {
        None,
        Charged,
        InsufficientFunds,
        RevokedApproval,
        Cancelled,
        NotDue
    }

    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        uint256 indexed merchantId,
        address indexed payer,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt
    );

    event SubscriptionCharged(
        uint256 indexed subscriptionId,
        bytes32 indexed chargeAttemptId,
        uint256 amount,
        uint256 feeAmount,
        uint256 netAmount,
        uint64 nextChargeAt
    );

    event SubscriptionChargeSkipped(
        uint256 indexed subscriptionId, bytes32 indexed chargeAttemptId, ChargeOutcome outcome
    );

    event SubscriptionCancelled(uint256 indexed subscriptionId, address indexed by);

    error Subscriptions__InvalidToken(address token);
    error Subscriptions__InvalidInterval();
    error Subscriptions__InvalidAmount();
    error Subscriptions__InvalidMerchantId();
    error Subscriptions__UnauthorisedCharger();
    error Subscriptions__DuplicateAttempt(bytes32 chargeAttemptId);
    error Subscriptions__UnknownSubscription(uint256 subscriptionId);
    error Subscriptions__NotSubscriptionParty();
    error Subscriptions__LengthMismatch();

    function createSubscription(uint256 merchantId, address token, uint256 amount, uint32 interval, uint64 startAt)
        external
        returns (uint256 subscriptionId);

    function cancel(uint256 subscriptionId) external;

    function batchCharge(uint256[] calldata subscriptionIds, bytes32[] calldata chargeAttemptIds)
        external
        returns (ChargeOutcome[] memory outcomes);

    function getSubscription(uint256 subscriptionId) external view returns (Subscription memory);
    function isAttemptUsed(bytes32 chargeAttemptId) external view returns (bool);
}
