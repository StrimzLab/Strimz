// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IStrimzRegistry } from "../interfaces/IStrimzRegistry.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title StrimzRegistry
/// @notice Merchant identity and payout policy. UUPS upgradeable,
///         ERC-7201 storage.
/// @custom:oz-upgrades-unsafe-allow constructor
contract StrimzRegistry is IStrimzRegistry, StrimzAccessControl, UUPSUpgradeable {
    uint16 public constant override MAX_FEE_BPS = 500; // 5%
    /// @notice 24-hour delay on payout rotation. A compromised owner
    ///         key has this window to be noticed and revoked before
    ///         funds flow to the attacker.
    uint64 public constant override PAYOUT_CHANGE_DELAY = 24 hours;
    /// @notice Delay on fee increases by FEE_MANAGER_ROLE, so a leaked
    ///         scheduler key can't raise fees before the Safe can react.
    uint64 public constant FEE_INCREASE_DELAY = 24 hours;

    struct PendingFee {
        uint16 feeBps;
        uint64 effectiveAt;
    }

    /// @custom:storage-location erc7201:strimz.storage.StrimzRegistry
    struct Storage {
        uint256 nextMerchantId;
        mapping(uint256 merchantId => Merchant data) merchants;
        mapping(uint256 merchantId => uint64 acceptableAt) ownershipAcceptableAt;
        mapping(uint256 merchantId => PendingFee pending) pendingFees;
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
        if (admin == address(0)) revert Registry__ZeroAddress();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(MERCHANT_REGISTRAR_ROLE, admin);
        _setRoleAdmin(FEE_MANAGER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(MERCHANT_REGISTRAR_ROLE, ADMIN_ROLE);
        _s().nextMerchantId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    // ---------- Read ----------

    /// @inheritdoc IStrimzRegistry
    function nextMerchantId() external view override returns (uint256) {
        return _s().nextMerchantId;
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

    /// @inheritdoc IStrimzRegistry
    function pendingOwnerOf(uint256 merchantId) external view override returns (address) {
        return _load(merchantId).pendingOwner;
    }

    function pendingOwnerAcceptableAt(uint256 merchantId) external view override returns (uint64) {
        _load(merchantId);
        return _s().ownershipAcceptableAt[merchantId];
    }

    // ---------- Register ----------

    /// @inheritdoc IStrimzRegistry
    function registerMerchant(
        address owner,
        address payoutAddress,
        uint16 feeBps,
        uint16 maxFeeBps,
        uint256 parentMerchantId
    ) external override onlyRole(MERCHANT_REGISTRAR_ROLE) returns (uint256 merchantId) {
        if (owner == address(0) || payoutAddress == address(0)) revert Registry__ZeroAddress();
        if (maxFeeBps > MAX_FEE_BPS) revert Registry__FeeTooHigh(maxFeeBps);
        if (feeBps > maxFeeBps) revert Registry__FeeExceedsMax(feeBps, maxFeeBps);

        Storage storage $ = _s();
        if (parentMerchantId != 0) {
            if ($.merchants[parentMerchantId].owner == address(0)) {
                revert Registry__UnknownParentMerchant(parentMerchantId);
            }
        }

        merchantId = $.nextMerchantId;
        unchecked {
            $.nextMerchantId = merchantId + 1;
        }
        $.merchants[merchantId] = Merchant({
            owner: owner,
            feeBps: feeBps,
            active: true,
            payoutAddress: payoutAddress,
            parentMerchantId: parentMerchantId,
            pendingOwner: address(0),
            pendingPayoutAddress: address(0),
            payoutChangeCommitAt: 0,
            maxFeeBps: maxFeeBps
        });

        emit MerchantRegistered(merchantId, owner, payoutAddress, feeBps, maxFeeBps, parentMerchantId);
    }

    // ---------- Fee ----------

    /// @inheritdoc IStrimzRegistry
    function setFeeBps(uint256 merchantId, uint16 newFeeBps) external override {
        bool admin = hasRole(ADMIN_ROLE, msg.sender);
        if (!admin && !hasRole(FEE_MANAGER_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, FEE_MANAGER_ROLE);
        }
        if (newFeeBps > MAX_FEE_BPS) revert Registry__FeeTooHigh(newFeeBps);
        Merchant storage m = _load(merchantId);
        if (newFeeBps > m.maxFeeBps) revert Registry__FeeExceedsMax(newFeeBps, m.maxFeeBps);

        Storage storage $ = _s();
        if (!admin && newFeeBps > m.feeBps) {
            uint64 effectiveAt = uint64(block.timestamp) + FEE_INCREASE_DELAY;
            $.pendingFees[merchantId] = PendingFee({ feeBps: newFeeBps, effectiveAt: effectiveAt });
            emit MerchantFeeIncreaseScheduled(merchantId, newFeeBps, effectiveAt);
            return;
        }
        delete $.pendingFees[merchantId];
        m.feeBps = newFeeBps;
        emit MerchantFeeBpsUpdated(merchantId, newFeeBps);
    }

    /// @inheritdoc IStrimzRegistry
    function commitFeeBps(uint256 merchantId) external override {
        Merchant storage m = _load(merchantId);
        Storage storage $ = _s();
        PendingFee memory p = $.pendingFees[merchantId];
        if (p.effectiveAt == 0) revert Registry__NoPendingFeeChange();
        if (block.timestamp < p.effectiveAt) revert Registry__FeeChangeNotDue();
        delete $.pendingFees[merchantId];
        m.feeBps = p.feeBps;
        emit MerchantFeeBpsUpdated(merchantId, p.feeBps);
    }

    /// @inheritdoc IStrimzRegistry
    function cancelFeeIncrease(uint256 merchantId) external override onlyRole(ADMIN_ROLE) {
        _load(merchantId);
        Storage storage $ = _s();
        if ($.pendingFees[merchantId].effectiveAt == 0) revert Registry__NoPendingFeeChange();
        delete $.pendingFees[merchantId];
        emit MerchantFeeIncreaseCancelled(merchantId);
    }

    /// @inheritdoc IStrimzRegistry
    function pendingFeeOf(uint256 merchantId) external view override returns (uint16 feeBps, uint64 effectiveAt) {
        _load(merchantId);
        PendingFee memory p = _s().pendingFees[merchantId];
        return (p.feeBps, p.effectiveAt);
    }

    // ---------- Active flag ----------

    /// @inheritdoc IStrimzRegistry
    function setActive(uint256 merchantId, bool active) external override onlyRole(ADMIN_ROLE) {
        Merchant storage m = _load(merchantId);
        m.active = active;
        emit MerchantActiveSet(merchantId, active);
    }

    // ---------- Payout: initiate → wait → commit ----------

    /// @inheritdoc IStrimzRegistry
    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        if (newPayoutAddress == address(0)) revert Registry__ZeroAddress();
        if (newPayoutAddress == m.payoutAddress) revert Registry__SamePayoutAddress();
        m.pendingPayoutAddress = newPayoutAddress;
        m.payoutChangeCommitAt = uint64(block.timestamp) + PAYOUT_CHANGE_DELAY;
        emit MerchantPayoutChangeInitiated(merchantId, newPayoutAddress, m.payoutChangeCommitAt);
    }

    /// @inheritdoc IStrimzRegistry
    function commitPayoutAddress(uint256 merchantId) external override {
        Merchant storage m = _load(merchantId);
        if (m.pendingPayoutAddress == address(0)) revert Registry__NoPendingPayoutChange();
        if (block.timestamp < m.payoutChangeCommitAt) revert Registry__PayoutChangeNotDue();
        address newAddr = m.pendingPayoutAddress;
        m.payoutAddress = newAddr;
        m.pendingPayoutAddress = address(0);
        m.payoutChangeCommitAt = 0;
        emit MerchantPayoutAddressUpdated(merchantId, newAddr);
    }

    /// @inheritdoc IStrimzRegistry
    function cancelPayoutAddressChange(uint256 merchantId) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        _cancelPayoutChange(merchantId, m);
    }

    function adminCancelPayoutChange(uint256 merchantId) external override onlyRole(ADMIN_ROLE) {
        _cancelPayoutChange(merchantId, _load(merchantId));
    }

    // ---------- Two-step ownership ----------

    /// @inheritdoc IStrimzRegistry
    function transferMerchantOwnership(uint256 merchantId, address newOwner) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        if (newOwner == address(0)) revert Registry__ZeroAddress();
        if (newOwner == m.owner) revert Registry__SameOwner();
        m.pendingOwner = newOwner;
        _s().ownershipAcceptableAt[merchantId] = uint64(block.timestamp) + PAYOUT_CHANGE_DELAY;
        emit MerchantOwnershipTransferInitiated(merchantId, m.owner, newOwner);
    }

    /// @inheritdoc IStrimzRegistry
    function acceptMerchantOwnership(uint256 merchantId) external override {
        Merchant storage m = _load(merchantId);
        address pending = m.pendingOwner;
        if (pending == address(0)) revert Registry__NoPendingTransfer();
        if (msg.sender != pending) revert Registry__NotPendingOwner();
        Storage storage $ = _s();
        uint64 acceptableAt = $.ownershipAcceptableAt[merchantId];
        if (acceptableAt == 0 || block.timestamp < acceptableAt) revert Registry__OwnershipTransferNotDue();

        address previous = m.owner;
        m.owner = pending;
        m.pendingOwner = address(0);
        delete $.ownershipAcceptableAt[merchantId];
        if (m.pendingPayoutAddress != address(0)) {
            m.pendingPayoutAddress = address(0);
            m.payoutChangeCommitAt = 0;
            emit MerchantPayoutChangeCancelled(merchantId);
        }
        emit MerchantOwnershipTransferAccepted(merchantId, previous, pending);
    }

    /// @inheritdoc IStrimzRegistry
    function cancelOwnershipTransfer(uint256 merchantId) external override {
        Merchant storage m = _load(merchantId);
        if (msg.sender != m.owner) revert Registry__NotMerchantOwner();
        _cancelOwnershipTransfer(merchantId, m);
    }

    function adminCancelOwnershipTransfer(uint256 merchantId) external override onlyRole(ADMIN_ROLE) {
        _cancelOwnershipTransfer(merchantId, _load(merchantId));
    }

    function _cancelPayoutChange(uint256 merchantId, Merchant storage m) private {
        if (m.pendingPayoutAddress == address(0)) revert Registry__NoPendingPayoutChange();
        m.pendingPayoutAddress = address(0);
        m.payoutChangeCommitAt = 0;
        emit MerchantPayoutChangeCancelled(merchantId);
    }

    function _cancelOwnershipTransfer(uint256 merchantId, Merchant storage m) private {
        if (m.pendingOwner == address(0)) revert Registry__NoPendingTransfer();
        m.pendingOwner = address(0);
        delete _s().ownershipAcceptableAt[merchantId];
        emit MerchantOwnershipTransferCancelled(merchantId);
    }

    function _load(uint256 merchantId) private view returns (Merchant storage m) {
        m = _s().merchants[merchantId];
        if (m.owner == address(0)) revert Registry__UnknownMerchant(merchantId);
    }
}
