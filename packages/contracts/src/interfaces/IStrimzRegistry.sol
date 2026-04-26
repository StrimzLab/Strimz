// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzRegistry
/// @notice On-chain merchant directory. Payments and Subscriptions read merchant
///         state (payout address, fee bps, active flag) from here so values can
///         rotate without redeploying the value-moving contracts.
interface IStrimzRegistry {
    /// @dev Two-slot layout for cache-friendly reads:
    ///        slot 0: owner (160) + feeBps (16) + active (8) + reserved (72)
    ///        slot 1: payoutAddress (160) + reserved (96)
    ///      Slot order matters — Solidity packs fields into the same slot
    ///      when their combined size fits.
    struct Merchant {
        address owner;
        uint16 feeBps;
        bool active;
        address payoutAddress;
    }

    event MerchantRegistered(
        uint256 indexed merchantId, address indexed owner, address payoutAddress, uint16 feeBps
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

    function MAX_FEE_BPS() external view returns (uint16);
    function nextMerchantId() external view returns (uint256);

    function registerMerchant(address owner, address payoutAddress, uint16 feeBps)
        external
        returns (uint256 merchantId);

    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external;
    function setFeeBps(uint256 merchantId, uint16 newFeeBps) external;
    function setActive(uint256 merchantId, bool active) external;
    function transferMerchantOwnership(uint256 merchantId, address newOwner) external;

    function getMerchant(uint256 merchantId) external view returns (Merchant memory);
    function requireActiveMerchant(uint256 merchantId) external view returns (Merchant memory);
}
