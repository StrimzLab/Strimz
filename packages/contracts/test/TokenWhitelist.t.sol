// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { ITokenWhitelist } from "../src/interfaces/ITokenWhitelist.sol";

contract TokenWhitelistTest is StrimzTestBase {
    TokenWhitelist internal whitelist;

    function setUp() public {
        _setUpTokens();
        whitelist = _deployTokenWhitelist(admin);
    }

    function test_adminCanAddAndRemove() public {
        vm.prank(admin);
        whitelist.add(address(usdc));
        assertTrue(whitelist.isWhitelisted(address(usdc)));

        vm.prank(admin);
        whitelist.remove(address(usdc));
        assertFalse(whitelist.isWhitelisted(address(usdc)));
    }

    function test_nonAdminCannotAdd() public {
        vm.prank(payer);
        vm.expectRevert();
        whitelist.add(address(usdc));
    }

    function test_rejectsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ITokenWhitelist.TokenWhitelist__ZeroAddress.selector);
        whitelist.add(address(0));
    }

    function test_rejectsDoubleAdd() public {
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        vm.expectRevert(
            abi.encodeWithSelector(ITokenWhitelist.TokenWhitelist__AlreadyWhitelisted.selector, address(usdc))
        );
        whitelist.add(address(usdc));
        vm.stopPrank();
    }

    function test_implementationCannotBeInitialised() public {
        TokenWhitelist impl = new TokenWhitelist();
        vm.expectRevert();
        impl.initialize(admin);
    }
}
