// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzRegistry
/// @notice On-chain merchant directory. Payments and Subscriptions read merchant
///         state (payout address, fee bps, active flag) from here so values can
///         rotate without redeploying the value-moving contracts.
interface IStrimzRegistry {
    /// @dev Three-slot layout for cache-friendly reads:
    ///        slot 0: owner (160) + feeBps (16) + active (8) + reserved (72)
    ///        slot 1: payoutAddress (160) + reserved (96)
    ///        slot 2: parentMerchantId (256)
    ///      Slot order matters — Solidity packs fields into the same slot
    ///      when their combined size fits. The parent id needs its own slot
    ///      because we keep it as a full uint256 (matches `merchantId` type).
    ///
    /// @dev `parentMerchantId == 0` means flat / top-level. The Registry
    ///      never issues a merchantId of 0, so 0 is an unambiguous sentinel
    ///      for "no parent". Sub-merchants are first-class merchants with
    ///      their own owner, payoutAddress, fee, and active flag — the
    ///      parent relationship is purely organisational (used off-chain
    ///      for reporting, sub-tenancy billing roll-ups, etc.).
    struct Merchant {
        address owner;
        uint16 feeBps;
        bool active;
        address payoutAddress;
        uint256 parentMerchantId;
    }

    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed owner,
        address payoutAddress,
        uint16 feeBps,
        uint256 parentMerchantId
    );
    event MerchantPayoutAddressUpdated(uint256 indexed merchantId, address newPayoutAddress);
    event MerchantFeeBpsUpdated(uint256 indexed merchantId, uint16 newFeeBps);
    event MerchantActiveSet(uint256 indexed merchantId, bool active);
    event MerchantOwnerTransferred(uint256 indexed merchantId, address newOwner);

    error Registry__ZeroAddress();
    error Registry__UnknownMerchant(uint256 merchantId);
    error Registry__NotMerchantOwner();
    error Registry__FeeTooHigh(uint16 feeBps);
    error Registry__MerchantInactive(uint256 merchantId);
    error Registry__UnknownParentMerchant(uint256 parentMerchantId);

    /// @dev Auto-generated getter for the SCREAMING_SNAKE_CASE constant
    ///      `MAX_FEE_BPS` on the implementation. Solidity convention puts
    ///      constants in upper case, so the matching getter inherits that
    ///      casing. Lint suppressions acknowledge the convention.
    // solhint-disable-next-line func-name-mixedcase
    // forge-lint: disable-next-line(mixed-case-function)
    function MAX_FEE_BPS() external view returns (uint16);
    function nextMerchantId() external view returns (uint256);

    /// @param owner The wallet that controls this merchant.
    /// @param payoutAddress Where settlement funds land.
    /// @param feeBps Platform fee in basis points (<= MAX_FEE_BPS).
    /// @param parentMerchantId 0 for a flat merchant; otherwise the id of
    ///        an existing merchant in this Registry. Sub-merchants inherit
    ///        no policy from their parent — each row is independent.
    function registerMerchant(
        address owner,
        address payoutAddress,
        uint16 feeBps,
        uint256 parentMerchantId
    ) external returns (uint256 merchantId);

    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external;
    function setFeeBps(uint256 merchantId, uint16 newFeeBps) external;
    function setActive(uint256 merchantId, bool active) external;
    function transferMerchantOwnership(uint256 merchantId, address newOwner) external;

    function getMerchant(uint256 merchantId) external view returns (Merchant memory);
    function requireActiveMerchant(uint256 merchantId) external view returns (Merchant memory);
}
