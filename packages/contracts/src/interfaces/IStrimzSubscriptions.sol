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
    ///        slot 3: endAt (64) + cancelled (8)                        → 72 bits used
    ///      merchantId uses uint96 (≈7.9×10²⁸ merchants — far more than
    ///      will ever exist). `endAt == 0` means open-ended; this matches
    ///      the natural zero-value semantics so the field can be added
    ///      without breaking existing zero-valued storage assumptions.
    struct Subscription {
        address payer;
        uint64 nextChargeAt;
        uint32 interval;
        address token;
        uint96 merchantId;
        uint256 amount;
        uint64 endAt;
        bool cancelled;
    }

    /// @dev `None=0` so an uninitialised slot never reads as a valid
    ///      outcome. Indices are frozen — appending new values only.
    enum ChargeOutcome {
        None,               // 0
        Charged,            // 1
        InsufficientFunds,  // 2  payer balance < amount
        RevokedApproval,    // 3  payer allowance < amount
        Cancelled,          // 4
        NotDue,             // 5  nextChargeAt > now
        Ended,              // 6  past endAt
        Duplicate,          // 7  chargeAttemptId already spent
        Unknown,            // 8  subscriptionId never existed
        MerchantInactive,   // 9  merchant frozen or unknown at charge time
        TransferFailed,     // 10 token transfer reverted (blocklist, etc.)
        TokenNotAllowed     // 11 token removed from the whitelist
    }

    /// @notice EIP-2612 permit fields the payer signs for the token.
    struct PermitData {
        address owner;
        uint256 value;
        uint256 deadline;
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

    event SubscriptionPeriodsSkipped(uint256 indexed subscriptionId, uint256 periodsSkipped, uint64 paidPeriodStart);

    event SubscriptionChargeSkipped(
        uint256 indexed subscriptionId, bytes32 indexed chargeAttemptId, ChargeOutcome outcome
    );

    event SubscriptionCancelled(uint256 indexed subscriptionId, address indexed by);
    event SubscriptionReinstated(uint256 indexed subscriptionId, address indexed by);
    event TokensRescued(address indexed token, address indexed to, uint256 amount, address indexed by);

    error Subscriptions__InvalidToken(address token);
    error Subscriptions__InvalidInterval();
    error Subscriptions__InvalidAmount();
    error Subscriptions__InvalidMerchantId();
    error Subscriptions__InvalidEndAt();
    error Subscriptions__InvalidStartAt();
    error Subscriptions__UnauthorisedCharger();
    error Subscriptions__DuplicateAttempt(bytes32 chargeAttemptId);
    error Subscriptions__UnknownSubscription(uint256 subscriptionId);
    error Subscriptions__NotSubscriptionParty();
    error Subscriptions__LengthMismatch();
    error Subscriptions__UnsupportedCapability(address token);
    error Subscriptions__InvalidIntent();
    error Subscriptions__AlreadyCancelled(uint256 subscriptionId);
    error Subscriptions__IntentAlreadyUsed(bytes32 nonce);
    error Subscriptions__PermitBelowAmount(uint256 value, uint256 amount);
    error Subscriptions__NotReinstatable(uint256 subscriptionId);
    error Subscriptions__ReinstateWindowClosed(uint256 subscriptionId);
    /// @notice A payer without code sent a permit signature that isn't 65 bytes.
    error Subscriptions__InvalidSignature();

    /// @param merchantId The merchant the subscription bills to.
    /// @param token ERC20 token address — must be whitelisted.
    /// @param amount Per-period charge amount.
    /// @param interval Seconds between charges.
    /// @param startAt Unix timestamp of the first charge; 0 = now.
    /// @param endAt Unix timestamp after which charges stop; 0 = open-ended.
    ///        Must be strictly greater than `startAt` (or 0 for open-ended).
    function createSubscription(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt
    ) external returns (uint256 subscriptionId);

    /// @notice Enrol a subscription in a single transaction by combining
    ///         an EIP-2612 `permit` with the standard `createSubscription`
    ///         logic. The payer signs one EIP-712 message; a relayer (or
    ///         the payer themselves) submits. The subscription's `payer`
    ///         field is set from `permitData.owner` rather than `msg.sender`
    ///         so the meta-tx pattern works.
    /// @param merchantId The merchant the subscription bills to.
    /// @param token ERC20 token address — must be whitelisted AND have
    ///        `CAP_PERMIT_2612` set on TokenWhitelist.
    /// @param amount Per-period charge amount.
    /// @param interval Seconds between charges.
    /// @param startAt Unix timestamp of the first charge; 0 = now.
    /// @param intentSig SubscriptionIntent signature verified by the
    ///        contract. Binds every subscription parameter so a valid
    ///        permit cannot be redirected to a different subscription.
    function permitAndCreateSubscription(
        uint256 merchantId,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        bytes32 nonce,
        PermitData calldata permitData,
        bytes calldata permitSig,
        bytes calldata intentSig
    ) external returns (uint256 subscriptionId);

    /// @notice Callable by the payer, the merchant owner, or a CANCELLER_ROLE holder cancelling for the merchant.
    function cancel(uint256 subscriptionId) external;

    /// @notice Undoes a CANCELLER_ROLE cancel within `REINSTATE_WINDOW`. ADMIN_ROLE only.
    function reinstate(uint256 subscriptionId) external;

    /// @notice When a CANCELLER_ROLE holder cancelled it, or 0.
    function operatorCancelledAt(uint256 subscriptionId) external view returns (uint64);

    function batchCharge(uint256[] calldata subscriptionIds, bytes32[] calldata chargeAttemptIds)
        external
        returns (ChargeOutcome[] memory outcomes);

    function getSubscription(uint256 subscriptionId) external view returns (Subscription memory);
    function isAttemptUsed(bytes32 chargeAttemptId) external view returns (bool);

    /// @notice Returns tokens sent straight to this contract. It never holds
    ///         payment funds between transactions.
    function rescue(address token, address to, uint256 amount) external;
}
