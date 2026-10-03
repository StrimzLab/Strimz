// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IStrimzRegistry } from "../../src/interfaces/IStrimzRegistry.sol";
import { StrimzAccessControl } from "../../src/access/StrimzAccessControl.sol";

contract StrimzRegistryV1 is StrimzAccessControl, UUPSUpgradeable {
    uint64 public constant PAYOUT_CHANGE_DELAY = 24 hours;

    /// @custom:storage-location erc7201:strimz.storage.StrimzRegistry
    struct Storage {
        uint256 nextMerchantId;
        mapping(uint256 merchantId => IStrimzRegistry.Merchant data) merchants;
    }

    bytes32 private constant STORAGE_SLOT = 0x1df0a4bbe4ea85c7d9dcc5ec3a89ebcd5bd171b19af6bd05a4a5d26180d54600;

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

    function registerMerchant(address owner, address payoutAddress, uint16 feeBps, uint256 parentMerchantId)
        external
        onlyRole(MERCHANT_REGISTRAR_ROLE)
        returns (uint256 merchantId)
    {
        Storage storage $ = _s();
        merchantId = $.nextMerchantId;
        $.nextMerchantId = merchantId + 1;
        $.merchants[merchantId] = IStrimzRegistry.Merchant({
            owner: owner,
            feeBps: feeBps,
            active: true,
            payoutAddress: payoutAddress,
            parentMerchantId: parentMerchantId,
            pendingOwner: address(0),
            pendingPayoutAddress: address(0),
            payoutChangeCommitAt: 0,
            maxFeeBps: feeBps
        });
    }

    function setPayoutAddress(uint256 merchantId, address newPayoutAddress) external {
        IStrimzRegistry.Merchant storage m = _s().merchants[merchantId];
        if (msg.sender != m.owner) revert IStrimzRegistry.Registry__NotMerchantOwner();
        m.pendingPayoutAddress = newPayoutAddress;
        m.payoutChangeCommitAt = uint64(block.timestamp) + PAYOUT_CHANGE_DELAY;
    }

    function transferMerchantOwnership(uint256 merchantId, address newOwner) external {
        IStrimzRegistry.Merchant storage m = _s().merchants[merchantId];
        if (msg.sender != m.owner) revert IStrimzRegistry.Registry__NotMerchantOwner();
        m.pendingOwner = newOwner;
    }

    function setActive(uint256 merchantId, bool active) external onlyRole(ADMIN_ROLE) {
        _s().merchants[merchantId].active = active;
    }
}
