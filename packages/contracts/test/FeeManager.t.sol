// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

contract FeeManagerTest is StrimzTestBase {
    uint16 internal constant STARTER_BPS = 50;
    uint16 internal constant GROWTH_BPS = 40;

    StrimzRegistry internal registry;
    address internal feeManager;

    function setUp() public {
        registry = _deployRegistry(admin);
        feeManager = makeAddr("feeManager");
        bytes32 role = registry.FEE_MANAGER_ROLE();
        vm.prank(admin);
        registry.grantRole(role, feeManager);
    }

    function _registerFree() internal returns (uint256 id) {
        vm.prank(admin);
        id = registry.registerMerchant(merchant, merchantPayout, 0, STARTER_BPS, 0);
    }

    function test_registerStoresTheCeilingSeparately() public {
        uint256 id = _registerFree();
        IStrimzRegistry.Merchant memory m = registry.getMerchant(id);
        assertEq(m.feeBps, 0, "free plan fee");
        assertEq(m.maxFeeBps, STARTER_BPS, "ceiling at the highest plan rate");
    }

    function test_registerRejectsAFeeAboveItsCeiling() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzRegistry.Registry__FeeExceedsMax.selector, uint16(60), STARTER_BPS)
        );
        registry.registerMerchant(merchant, merchantPayout, 60, STARTER_BPS, 0);
    }

    function test_registerRejectsACeilingAboveTheAbsoluteMax() public {
        uint16 tooHigh = registry.MAX_FEE_BPS() + 1;
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IStrimzRegistry.Registry__FeeTooHigh.selector, tooHigh));
        registry.registerMerchant(merchant, merchantPayout, 0, tooHigh, 0);
    }

    function test_feeManagerMovesAFreeMerchantToStarterThenGrowth() public {
        uint256 id = _registerFree();
        vm.prank(feeManager);
        registry.setFeeBps(id, STARTER_BPS);
        assertEq(registry.getMerchant(id).feeBps, STARTER_BPS);
        vm.prank(feeManager);
        registry.setFeeBps(id, GROWTH_BPS);
        assertEq(registry.getMerchant(id).feeBps, GROWTH_BPS);
    }

    function test_feeManagerCannotExceedTheCeiling() public {
        uint256 id = _registerFree();
        vm.prank(feeManager);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzRegistry.Registry__FeeExceedsMax.selector, uint16(51), STARTER_BPS)
        );
        registry.setFeeBps(id, 51);
    }

    function test_strangerCannotSetAFee() public {
        uint256 id = _registerFree();
        bytes32 role = registry.FEE_MANAGER_ROLE();
        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, merchant, role));
        registry.setFeeBps(id, 0);
    }

    function test_ownerCanNoLongerLowerTheCeiling() public {
        uint256 id = _registerFree();
        vm.prank(merchant);
        (bool ok,) =
            address(registry).call(abi.encodeWithSignature("setMaxFeeBps(uint256,uint16)", id, uint16(0)));
        assertFalse(ok, "setMaxFeeBps must not exist");
        assertEq(registry.getMerchant(id).maxFeeBps, STARTER_BPS);
    }

    function test_adminIsTheRoleAdminOfFeeManager() public view {
        assertEq(registry.getRoleAdmin(registry.FEE_MANAGER_ROLE()), registry.ADMIN_ROLE());
    }
}
