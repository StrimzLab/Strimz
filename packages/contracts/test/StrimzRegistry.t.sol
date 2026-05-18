// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

contract StrimzRegistryTest is StrimzTestBase {
    StrimzRegistry internal registry;

    function setUp() public {
        registry = _deployRegistry(admin);
    }

    function test_registerAssignsIncrementingId() public {
        vm.startPrank(admin);
        uint256 id1 = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        uint256 id2 = registry.registerMerchant(merchant, merchantPayout, 150, 0);
        vm.stopPrank();
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_rejectsFeeAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__FeeTooHigh.selector, 600));
        registry.registerMerchant(merchant, merchantPayout, 600, 0);
    }

    function test_ownerCanRotatePayoutAddress() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        address newPayout = makeAddr("newPayout");

        vm.prank(merchant);
        registry.setPayoutAddress(id, newPayout);

        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.payoutAddress, newPayout);
    }

    function test_nonOwnerCannotRotatePayoutAddress() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);

        vm.prank(payer);
        vm.expectRevert(IStrimzRegistry.Registry__NotMerchantOwner.selector);
        registry.setPayoutAddress(id, makeAddr("x"));
    }

    function test_requireActiveMerchantRevertsWhenInactive() public {
        vm.prank(admin);
        uint256 id = registry.registerMerchant(merchant, merchantPayout, 100, 0);
        vm.prank(admin);
        registry.setActive(id, false);

        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__MerchantInactive.selector, id));
        registry.requireActiveMerchant(id);
    }
}
