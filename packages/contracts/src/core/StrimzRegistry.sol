// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title StrimzRegistry
/// @notice Source of truth for merchant identity and payout policy.
/// @dev UUPS upgradeable with ERC-7201 namespaced storage. Future versions can
///      extend the storage layout without touching existing slots.
/// @custom:oz-upgrades-unsafe-allow constructor
contract StrimzRegistry is IStrimzRegistry, StrimzAccessControl, UUPSUpgradeable {
    uint16 public constant override MAX_FEE_BPS = 500; // 5%

    /// @custom:storage-location erc7201:strimz.storage.StrimzRegistry
    struct Storage {
        uint256 nextMerchantId;
        mapping(uint256 merchantId => Merchant data) merchants;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.StrimzRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0x1df0a4bbe4ea85c7d9dcc5ec3a89ebcd5bd171b19af6bd05a4a5d26180d54600;

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(MERCHANT_REGISTRAR_ROLE, admin);
        _s().nextMerchantId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    /// @inheritdoc IStrimzRegistry
    function nextMerchantId() external view override returns (uint256) {
        return _s().nextMerchantId;
    }

    /// @inheritdoc IStrimzRegistry
    function registerMerchant(address owner, address payoutAddress, uint16 feeBps)
        external
        override
        onlyRole(MERCHANT_REGISTRAR_ROLE)
        returns (uint256 merchantId)
    {
        if (owner == address(0) || payoutAddress == address(0)) revert Registry__ZeroAddress();
        if (feeBps > MAX_FEE_BPS) revert Registry__FeeTooHigh(feeBps);

        Storage storage $ = _s();
        merchantId = $.nextMerchantId;
        unchecked {
            $.nextMerchantId = merchantId + 1;
        }
        $.merchants[merchantId] =
            Merchant({ owner: owner, feeBps: feeBps, active: true, payoutAddress: payoutAddress });

        emit MerchantRegistered(merchantId, owner, payoutAddress, feeBps);
    }

    /// @inheritdoc IStrimzRegistry
    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        if (newPayoutAddress == address(0)) revert Registry__ZeroAddress();
        m.payoutAddress = newPayoutAddress;
        emit MerchantPayoutAddressUpdated(merchantId, newPayoutAddress);
    }

    /// @inheritdoc IStrimzRegistry
    function setFeeBps(uint256 merchantId, uint16 newFeeBps) external override onlyRole(ADMIN_ROLE) {
        if (newFeeBps > MAX_FEE_BPS) revert Registry__FeeTooHigh(newFeeBps);
        Merchant storage m = _load(merchantId);
        m.feeBps = newFeeBps;
        emit MerchantFeeBpsUpdated(merchantId, newFeeBps);
    }

    /// @inheritdoc IStrimzRegistry
    function setActive(uint256 merchantId, bool active) external override onlyRole(ADMIN_ROLE) {
        Merchant storage m = _load(merchantId);
        m.active = active;
        emit MerchantActiveSet(merchantId, active);
    }

    /// @inheritdoc IStrimzRegistry
    function transferMerchantOwnership(uint256 merchantId, address newOwner) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        if (newOwner == address(0)) revert Registry__ZeroAddress();
        m.owner = newOwner;
        emit MerchantOwnerTransferred(merchantId, newOwner);
    }

    /// @inheritdoc IStrimzRegistry
    function getMerchant(uint256 merchantId) external view override returns (Merchant memory) {
        return _load(merchantId);
    }

    /// @inheritdoc IStrimzRegistry
    function requireActiveMerchant(uint256 merchantId) external view override returns (Merchant memory m) {
        m = _load(merchantId);
        if (!m.active) revert Registry__MerchantInactive(merchantId);
    }

    function _load(uint256 merchantId) private view returns (Merchant storage m) {
        m = _s().merchants[merchantId];
        if (m.owner == address(0)) revert Registry__UnknownMerchant(merchantId);
    }
}
