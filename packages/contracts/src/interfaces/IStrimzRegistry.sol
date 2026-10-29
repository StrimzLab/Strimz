// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzRegistry
/// @notice Merchant directory read by Payments and Subscriptions.
interface IStrimzRegistry {
    /// @dev `parentMerchantId == 0` means top-level. IDs are 1-indexed
    ///      so 0 unambiguously means "no parent". `pendingOwner`,
    ///      `pendingPayoutAddress`, and `payoutChangeCommitAt` gate
    ///      the two multi-step flows that limit blast radius on a
    ///      compromised owner key. `maxFeeBps` is the ceiling the
    ///      merchant consented to at registration — admin can only
    ///      set fees at or below it.
    struct Merchant {
        address owner;
        uint16 feeBps;
        bool active;
        address payoutAddress;
        uint256 parentMerchantId;
        address pendingOwner;
        address pendingPayoutAddress;
        uint64 payoutChangeCommitAt;
        uint16 maxFeeBps;
    }

    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed owner,
        address payoutAddress,
        uint16 feeBps,
        uint16 maxFeeBps,
        uint256 parentMerchantId
    );
    event MerchantPayoutAddressUpdated(uint256 indexed merchantId, address newPayoutAddress);
    event MerchantPayoutChangeInitiated(
        uint256 indexed merchantId, address indexed newPayoutAddress, uint64 commitAt
    );
    event MerchantPayoutChangeCancelled(uint256 indexed merchantId);
    event MerchantFeeBpsUpdated(uint256 indexed merchantId, uint16 newFeeBps);
    event MerchantFeeIncreaseScheduled(uint256 indexed merchantId, uint16 feeBps, uint64 effectiveAt);
    event MerchantFeeIncreaseCancelled(uint256 indexed merchantId);
    event MerchantActiveSet(uint256 indexed merchantId, bool active);
    event MerchantOwnershipTransferInitiated(
        uint256 indexed merchantId, address indexed currentOwner, address indexed pendingOwner
    );
    event MerchantOwnershipTransferAccepted(
        uint256 indexed merchantId, address indexed previousOwner, address indexed newOwner
    );
    event MerchantOwnershipTransferCancelled(uint256 indexed merchantId);
    /// @dev Kept so old indexers can still decode historical logs.
    event MerchantOwnerTransferred(uint256 indexed merchantId, address newOwner);

    error Registry__ZeroAddress();
    error Registry__UnknownMerchant(uint256 merchantId);
    error Registry__NotMerchantOwner();
    error Registry__NotPendingOwner();
    error Registry__NoPendingTransfer();
    error Registry__FeeTooHigh(uint16 feeBps);
    error Registry__FeeExceedsMax(uint16 requested, uint16 max);
    error Registry__MerchantInactive(uint256 merchantId);
    error Registry__UnknownParentMerchant(uint256 parentMerchantId);
    error Registry__SameOwner();
    error Registry__SamePayoutAddress();
    error Registry__NoPendingPayoutChange();
    error Registry__PayoutChangeNotDue();
    error Registry__OwnershipTransferNotDue();
    error Registry__NoPendingFeeChange();
    error Registry__FeeChangeNotDue();

    // solhint-disable-next-line func-name-mixedcase
    // forge-lint: disable-next-line(mixed-case-function)
    function MAX_FEE_BPS() external view returns (uint16);

    /// @notice Delay applied to every payout-address change. Bounds the
    ///         blast radius of a compromised owner key.
    // solhint-disable-next-line func-name-mixedcase
    // forge-lint: disable-next-line(mixed-case-function)
    function PAYOUT_CHANGE_DELAY() external view returns (uint64);

    function nextMerchantId() external view returns (uint256);

    function registerMerchant(
        address owner,
        address payoutAddress,
        uint16 feeBps,
        uint16 maxFeeBps,
        uint256 parentMerchantId
    ) external returns (uint256 merchantId);

    /// @notice Sets a new fee, at or below the merchant's `maxFeeBps`. An
    ///         admin's change applies at once. A FEE_MANAGER_ROLE increase
    ///         waits `FEE_INCREASE_DELAY` and needs `commitFeeBps`.
    function setFeeBps(uint256 merchantId, uint16 newFeeBps) external;

    /// @notice Permissionless once the delay has passed.
    function commitFeeBps(uint256 merchantId) external;

    function cancelFeeIncrease(uint256 merchantId) external;

    function pendingFeeOf(uint256 merchantId) external view returns (uint16 feeBps, uint64 effectiveAt);

    function setActive(uint256 merchantId, bool active) external;

    /// @notice Merchant owner initiates a payout rotation. Effective
    ///         after `PAYOUT_CHANGE_DELAY`. Until commit, the old
    ///         address still receives every settlement.
    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external;

    /// @notice Permissionless — anyone commits after the delay. So the
    ///         merchant doesn't need two on-chain transactions to
    ///         complete a rotation.
    function commitPayoutAddress(uint256 merchantId) external;

    /// @notice Merchant owner drops a pending payout change. Escape
    ///         hatch when the initiate was a mistake or briefly
    ///         issued by an attacker before the key was revoked.
    function cancelPayoutAddressChange(uint256 merchantId) external;

    function adminCancelPayoutChange(uint256 merchantId) external;

    /// @notice Nominate a new owner. Current owner stays in charge
    ///         until the nominee calls `acceptMerchantOwnership`.
    function transferMerchantOwnership(uint256 merchantId, address newOwner) external;

    /// @notice Nominee accepts. Ownership moves in this call.
    function acceptMerchantOwnership(uint256 merchantId) external;

    /// @notice Current owner drops a pending nomination.
    function cancelOwnershipTransfer(uint256 merchantId) external;

    function adminCancelOwnershipTransfer(uint256 merchantId) external;

    function pendingOwnerOf(uint256 merchantId) external view returns (address);
    function pendingOwnerAcceptableAt(uint256 merchantId) external view returns (uint64);

    function getMerchant(uint256 merchantId) external view returns (Merchant memory);
    function requireActiveMerchant(uint256 merchantId) external view returns (Merchant memory);
}
