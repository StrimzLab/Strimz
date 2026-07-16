// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzRegistry.t
/// @notice Registry is the source of truth for merchant identity and
///         payout policy. Every value-moving contract reads it before
///         releasing funds, so the invariants below are what separate
///         a working platform from silent fund redirection.
///
///         What we prove:
///           1. Only registrars register; owners cannot self-mint.
///           2. Registration fee is captured as `maxFeeBps`; admin
///              cannot raise fees above what the merchant agreed to.
///           3. Merchants can lower their own max ceiling (not raise).
///           4. Payout rotation is time-delayed — the old address is
///              authoritative until the delay elapses, so a compromised
///              owner key has a window to be revoked.
///           5. Ownership transfer is two-step — the nominee must
///              actively claim in a separate tx.
///           6. Inactive merchants block downstream charges.
///           7. Zero-address inputs never silently succeed.

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

contract StrimzRegistryTest is StrimzTestBase {
    StrimzRegistry internal registry;

    function setUp() public {
        registry = _deployRegistry(admin);
    }

    // ---------- Register ----------

    function test_registerAssignsIncrementingId() public {
        vm.startPrank(admin);
        uint256 id1 = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        uint256 id2 = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        vm.stopPrank();
        assertEq(id1, 1, "first id starts at 1");
        assertEq(id2, 2);
    }

    function test_registerCapturesFeeAsMaxCeiling() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.feeBps, 150);
        assertEq(m.maxFeeBps, 150, "registration fee becomes the ceiling");
    }

    function test_registerRejectsFeeAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__FeeTooHigh.selector, 600));
        registry.registerMerchant(merchant, merchantPayout, 600, 0);
    }

    function test_registerRejectsZeroAddressParties() public {
        vm.startPrank(admin);
        vm.expectRevert(IStrimzRegistry.Registry__ZeroAddress.selector);
        registry.registerMerchant(address(0), merchantPayout, 100, 0);
        vm.expectRevert(IStrimzRegistry.Registry__ZeroAddress.selector);
        registry.registerMerchant(merchant, address(0), 100, 0);
        vm.stopPrank();
    }

    function test_registerRejectsUnknownParent() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__UnknownParentMerchant.selector, 42));
        registry.registerMerchant(merchant, merchantPayout, 100, 42);
    }

    // ---------- Fee changes ----------

    function test_adminCanLowerFeeWithinCeiling() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 200, 0);
        vm.prank(admin);
        registry.setFeeBps(id, 50);
        assertEq(registry.getMerchant(id).feeBps, 50);
    }

    // Admin cannot raise fees above what the merchant consented to.
    // A compromised admin therefore cannot silently hike fees platform-wide.
    function test_adminCannotRaiseAboveMerchantCeiling() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzRegistry.Registry__FeeExceedsMax.selector, 200, 100)
        );
        registry.setFeeBps(id, 200);
    }

    // Absolute ceiling still holds on setFeeBps too, in case maxFeeBps
    // somehow gets misconfigured.
    function test_setFeeBpsAbsoluteCeilingHolds() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 500, 0);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__FeeTooHigh.selector, 501));
        registry.setFeeBps(id, 501);
    }

    // Merchant can lower their own ceiling as defence against
    // compromised admin.
    function test_merchantCanLowerMaxFeeBps() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 200, 0);
        vm.prank(merchant);
        registry.setMaxFeeBps(id, 100);
        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.maxFeeBps, 100);
        // Current fee > new max snaps down.
        assertEq(m.feeBps, 100, "current fee snapped to new ceiling");
    }

    function test_merchantCannotRaiseMaxFeeBps() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__MaxFeeCanOnlyLower.selector);
        registry.setMaxFeeBps(id, 200);
    }

    function test_nonOwnerCannotChangeMaxFeeBps() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 200, 0);
        vm.prank(payer);
        vm.expectRevert(IStrimzRegistry.Registry__NotMerchantOwner.selector);
        registry.setMaxFeeBps(id, 100);
    }

    // ---------- Payout rotation (time-delayed) ----------

    // Initiating a rotation does NOT change the live payout address.
    // Old address keeps receiving until commit.
    function test_setPayoutAddressOnlyMarksPending() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address newPayout = makeAddr("newPayout");

        vm.prank(merchant);
        registry.setPayoutAddress(id, newPayout);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.payoutAddress, merchantPayout, "old payout still live");
        assertEq(m.pendingPayoutAddress, newPayout, "new payout only pending");
        assertGt(m.payoutChangeCommitAt, block.timestamp, "commit time in the future");
    }

    function test_commitBeforeDelayReverts() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        registry.setPayoutAddress(id, makeAddr("newPayout"));

        vm.expectRevert(IStrimzRegistry.Registry__PayoutChangeNotDue.selector);
        registry.commitPayoutAddress(id);
    }

    function test_commitAfterDelayLandsNewAddress() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address newPayout = makeAddr("newPayout");
        vm.prank(merchant);
        registry.setPayoutAddress(id, newPayout);

        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY() + 1);
        // Permissionless commit — anyone can push the pending change live.
        registry.commitPayoutAddress(id);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.payoutAddress, newPayout);
        assertEq(m.pendingPayoutAddress, address(0));
        assertEq(m.payoutChangeCommitAt, 0);
    }

    // The whole point of the delay: merchant can cancel if the initiate
    // was made by an attacker who briefly held the key.
    function test_ownerCanCancelPendingPayoutChange() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address hostile = makeAddr("hostilePayout");
        vm.prank(merchant);
        registry.setPayoutAddress(id, hostile);

        vm.prank(merchant);
        registry.cancelPayoutAddressChange(id);

        assertEq(registry.getMerchant(id).pendingPayoutAddress, address(0));

        // Post-cancel commit fails.
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY() + 1);
        vm.expectRevert(IStrimzRegistry.Registry__NoPendingPayoutChange.selector);
        registry.commitPayoutAddress(id);
    }

    function test_nonOwnerCannotInitiatePayoutChange() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(payer);
        vm.expectRevert(IStrimzRegistry.Registry__NotMerchantOwner.selector);
        registry.setPayoutAddress(id, makeAddr("attackerPayout"));
    }

    function test_payoutRotationRejectsZeroAddress() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__ZeroAddress.selector);
        registry.setPayoutAddress(id, address(0));
    }

    function test_payoutRotationRejectsSameAddress() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__SamePayoutAddress.selector);
        registry.setPayoutAddress(id, merchantPayout);
    }

    // ---------- Two-step ownership ----------

    function test_ownershipNominationDoesNotChangeOwner() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address next = makeAddr("nextOwner");

        vm.prank(merchant);
        registry.transferMerchantOwnership(id, next);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.owner, merchant, "current owner still seated");
        assertEq(m.pendingOwner, next, "nominee pending");
    }

    function test_onlyNomineeCanAccept() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address next = makeAddr("nextOwner");
        address random = makeAddr("random");

        vm.prank(merchant);
        registry.transferMerchantOwnership(id, next);

        vm.prank(random);
        vm.expectRevert(IStrimzRegistry.Registry__NotPendingOwner.selector);
        registry.acceptMerchantOwnership(id);

        vm.prank(next);
        registry.acceptMerchantOwnership(id);
        assertEq(registry.getMerchant(id).owner, next);
        assertEq(registry.getMerchant(id).pendingOwner, address(0));
    }

    function test_currentOwnerCanCancelPendingNomination() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        registry.transferMerchantOwnership(id, makeAddr("nextOwner"));
        vm.prank(merchant);
        registry.cancelOwnershipTransfer(id);
        assertEq(registry.pendingOwnerOf(id), address(0));
    }

    function test_secondNominationOverwritesFirst() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address first = makeAddr("first");
        address second = makeAddr("second");
        vm.startPrank(merchant);
        registry.transferMerchantOwnership(id, first);
        registry.transferMerchantOwnership(id, second);
        vm.stopPrank();

        vm.prank(first);
        vm.expectRevert(IStrimzRegistry.Registry__NotPendingOwner.selector);
        registry.acceptMerchantOwnership(id);

        vm.prank(second);
        registry.acceptMerchantOwnership(id);
        assertEq(registry.getMerchant(id).owner, second);
    }

    function test_ownershipTransferRejectsZero() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__ZeroAddress.selector);
        registry.transferMerchantOwnership(id, address(0));
    }

    function test_ownershipTransferRejectsSameOwner() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(merchant);
        vm.expectRevert(IStrimzRegistry.Registry__SameOwner.selector);
        registry.transferMerchantOwnership(id, merchant);
    }

    // ---------- Active flag ----------

    function test_requireActiveMerchantRevertsWhenInactive() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(admin);
        registry.setActive(id, false);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__MerchantInactive.selector, id));
        registry.requireActiveMerchant(id);
    }

    function test_requireActiveMerchantRevertsForUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__UnknownMerchant.selector, 42));
        registry.requireActiveMerchant(42);
    }
}
