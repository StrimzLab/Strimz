// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import { IFeeCollector } from "../interfaces/IFeeCollector.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title FeeCollector
/// @notice Pull-payment protocol fee accumulator. Payments and Subscriptions
///         push fees here via `accrue`; the treasury withdraws to a cold
///         wallet on a schedule.
/// @dev Uses `ReentrancyGuardTransient` (EIP-1153 transient storage) rather
///      than the constructor-bearing `ReentrancyGuard`. This satisfies the
///      OZ upgrades safety validator because there is no inherited
///      constructor to bypass behind the proxy, and the lock is
///      automatically cleared at end-of-transaction by the EVM. Arc
///      targets the Prague hard fork, so EIP-1153 is available.
///
///      The contract's own `constructor()` is the standard OZ proxy
///      pattern: it calls `_disableInitializers()` on the implementation
///      so the impl cannot be initialised directly. The validator only
///      accepts this when the contract carries the
///      `oz-upgrades-unsafe-allow` annotation below.
/// @custom:oz-upgrades-unsafe-allow constructor
contract FeeCollector is
    IFeeCollector,
    StrimzAccessControl,
    ReentrancyGuardTransient,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    /// @custom:storage-location erc7201:strimz.storage.FeeCollector
    struct Storage {
        mapping(address token => uint256 total) totalAccrued;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.FeeCollector")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0xc457980811bb6668d87ba110a0c70eaa5da05a8bf4dcefb9ca39df088da30700;

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
        _grantRole(TREASURY_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    /// @inheritdoc IFeeCollector
    function accrue(address token, uint256 merchantId, uint256 amount)
        external
        override
        onlyRole(FEE_ACCRUER_ROLE)
    {
        if (amount == 0) revert FeeCollector__ZeroAmount();
        Storage storage $ = _s();
        unchecked {
            // Bounded by total ever transferred in. Overflow requires > 2^256
            // token units — impossible for any realistic ERC20.
            $.totalAccrued[token] += amount;
        }
        emit FeeAccrued(token, merchantId, amount);
    }

    /// @inheritdoc IFeeCollector
    function withdraw(address token, address to, uint256 amount)
        external
        override
        onlyRole(TREASURY_ROLE)
        nonReentrant
    {
        if (amount == 0) revert FeeCollector__ZeroAmount();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert FeeCollector__InsufficientBalance();
        IERC20(token).safeTransfer(to, amount);
        emit FeeWithdrawn(token, to, amount);
    }

    /// @inheritdoc IFeeCollector
    function balanceOf(address token) external view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @inheritdoc IFeeCollector
    function totalAccrued(address token) external view override returns (uint256) {
        return _s().totalAccrued[token];
    }
}
