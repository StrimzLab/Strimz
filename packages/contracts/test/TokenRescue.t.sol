// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract TokenRescueTest is StrimzTestBase {
    StrimzRegistry internal registry;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;
    address internal sender;
    address internal stranger;

    uint256 internal constant STRAY = 25_000_000;
    uint256 internal constant AMOUNT = 100_000_000;
    bytes32 internal constant REF = keccak256("ref");

    event TokensRescued(address indexed token, address indexed to, uint256 amount, address indexed by);

    function setUp() public {
        sender = makeAddr("sender");
        stranger = makeAddr("stranger");
        _setUpTokens();
        registry = _deployRegistry(admin);
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        bytes32 accruer = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), whitelist.CAP_TRANSFER_AUTH_3009());
        feeCollector.grantRole(accruer, address(payments));
        merchantId = registry.registerMerchant(merchant, merchantPayout, 100, 100, 0);
        vm.stopPrank();

        _fund(sender, STRAY * 2);
        _fund(payer, AMOUNT);
    }

    function _straySend(address to) internal {
        vm.prank(sender);
        usdc.transfer(to, STRAY);
    }

    function test_adminReturnsStrayTokensFromPayments() public {
        _straySend(address(payments));

        vm.expectEmit(true, true, true, true, address(payments));
        emit TokensRescued(address(usdc), sender, STRAY, admin);
        vm.prank(admin);
        payments.rescue(address(usdc), sender, STRAY);

        assertEq(usdc.balanceOf(address(payments)), 0);
        assertEq(usdc.balanceOf(sender), STRAY * 2);
    }

    function test_adminReturnsStrayTokensFromSubscriptions() public {
        _straySend(address(subs));

        vm.expectEmit(true, true, true, true, address(subs));
        emit TokensRescued(address(usdc), sender, STRAY, admin);
        vm.prank(admin);
        subs.rescue(address(usdc), sender, STRAY);

        assertEq(usdc.balanceOf(address(subs)), 0);
        assertEq(usdc.balanceOf(sender), STRAY * 2);
    }

    function test_rescueWorksWhilePaused() public {
        _straySend(address(payments));
        _straySend(address(subs));
        vm.startPrank(admin);
        payments.pause();
        subs.pause();
        payments.rescue(address(usdc), sender, STRAY);
        subs.rescue(address(usdc), sender, STRAY);
        vm.stopPrank();
        assertEq(usdc.balanceOf(sender), STRAY * 2);
    }

    function test_onlyAdminRoleCanRescue() public {
        _straySend(address(payments));
        _straySend(address(subs));
        bytes32 adminRole = payments.ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, adminRole)
        );
        vm.prank(stranger);
        payments.rescue(address(usdc), stranger, STRAY);

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, adminRole)
        );
        vm.prank(stranger);
        subs.rescue(address(usdc), stranger, STRAY);
    }

    function test_defaultAdminAloneCannotRescue() public {
        _straySend(address(payments));
        address topAdmin = makeAddr("timelock");
        bytes32 top = payments.DEFAULT_ADMIN_ROLE();
        vm.prank(admin);
        payments.grantRole(top, topAdmin);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, topAdmin, payments.ADMIN_ROLE()
            )
        );
        vm.prank(topAdmin);
        payments.rescue(address(usdc), topAdmin, STRAY);
    }

    function test_chargerCannotRescue() public {
        _straySend(address(subs));
        address scheduler = makeAddr("scheduler");
        bytes32 charger = subs.CHARGER_ROLE();
        vm.prank(admin);
        subs.grantRole(charger, scheduler);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, scheduler, subs.ADMIN_ROLE()
            )
        );
        vm.prank(scheduler);
        subs.rescue(address(usdc), scheduler, STRAY);
    }

    function test_rescueRejectsZeroRecipientAndZeroAmount() public {
        _straySend(address(payments));
        _straySend(address(subs));
        vm.startPrank(admin);
        vm.expectRevert(IStrimzPayments.Payments__ZeroAddress.selector);
        payments.rescue(address(usdc), address(0), STRAY);
        vm.expectRevert(IStrimzPayments.Payments__InvalidAmount.selector);
        payments.rescue(address(usdc), sender, 0);
        vm.expectRevert(StrimzSubscriptions.Subscriptions__ZeroAddress.selector);
        subs.rescue(address(usdc), address(0), STRAY);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidAmount.selector);
        subs.rescue(address(usdc), sender, 0);
        vm.stopPrank();
    }

    function test_strayTokensDoNotChangeAPaymentWithAuthorization() public {
        _straySend(address(payments));
        IStrimzPayments.PayAuthorization memory a = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: keccak256("auth-1")
        });
        (uint8 v1, bytes32 r1, bytes32 s1) = _signReceiveWithAuthorization(
            usdc, payerPk, a.from, address(payments), a.amount, a.validAfter, a.validBefore, a.nonce
        );
        (uint8 v2, bytes32 r2, bytes32 s2) =
            _signPayIntent(payments, payerPk, merchantId, address(usdc), a.amount, a.nonce, a.validBefore, REF);

        payments.payWithAuthorization(
            merchantId, address(usdc), a, REF, abi.encodePacked(r1, s1, v1), abi.encodePacked(r2, s2, v2)
        );

        assertEq(usdc.balanceOf(merchantPayout), AMOUNT - AMOUNT / 100, "merchant paid exactly");
        assertEq(usdc.balanceOf(address(feeCollector)), AMOUNT / 100, "fee exact");
        assertEq(usdc.balanceOf(address(payments)), STRAY, "stray amount untouched");

        vm.prank(admin);
        payments.rescue(address(usdc), sender, STRAY);
        assertEq(usdc.balanceOf(address(payments)), 0);
    }
}
