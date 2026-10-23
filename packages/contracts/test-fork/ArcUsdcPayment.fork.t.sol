// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ArcForkBase } from "./ArcForkBase.sol";
import { MockErc1271Wallet } from "../test/Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";

contract ArcUsdcPaymentForkTest is ArcForkBase {
    uint16 internal constant FEE_BPS = 150;
    uint256 internal constant AMOUNT = 25_000_000;

    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    uint256 internal merchantId;
    uint256 internal blockedMerchantId;

    function setUp() public {
        _forkArcTestnet();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        bytes32 accruerRole = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(ARC_USDC));
        whitelist.setCapabilities(address(ARC_USDC), whitelist.CAP_TRANSFER_AUTH_3009());
        feeCollector.grantRole(accruerRole, address(payments));
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, FEE_BPS, 0);
        blockedMerchantId = registry.registerMerchant(vendor, ARC_TESTNET_BLOCKLISTED, FEE_BPS, FEE_BPS, 0);
        vm.stopPrank();

        vm.deal(payer, 100 ether);
    }

    function _pay(uint256 mid, bytes32 nonce) internal {
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce
        });
        bytes32 ref = keccak256(abi.encode("arc-fork", nonce));
        (uint8 v, bytes32 r, bytes32 s) = _signArcReceiveWithAuthorization(
            payerPk, auth.from, address(payments), auth.amount, auth.validAfter, auth.validBefore, auth.nonce
        );
        bytes memory authSig = abi.encodePacked(r, s, v);
        (v, r, s) = _signPayIntent(
            payments, payerPk, mid, address(ARC_USDC), auth.amount, auth.nonce, auth.validBefore, ref
        );
        payments.payWithAuthorization(mid, address(ARC_USDC), auth, ref, authSig, abi.encodePacked(r, s, v));
    }

    function test_nativeBalanceIsTheUsdcBalance() public view {
        assertEq(ARC_USDC.decimals(), 6);
        assertEq(ARC_USDC.balanceOf(payer), 100_000_000);
    }

    function test_payWithAuthorizationSettlesInArcUsdc() public {
        bytes32 nonce = keccak256("arc-fork-1");
        _pay(merchantId, nonce);

        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(ARC_USDC.balanceOf(merchantPayout), AMOUNT - fee, "merchant net");
        assertEq(ARC_USDC.balanceOf(address(feeCollector)), fee, "collector fee");
        assertEq(ARC_USDC.balanceOf(address(payments)), 0, "no residue");
        assertEq(ARC_USDC.balanceOf(payer), 100_000_000 - AMOUNT, "payer debited");
        assertTrue(ARC_USDC.authorizationState(payer, nonce), "nonce burnt");
    }

    function test_paymentToBlocklistedPayoutRevertsAndKeepsPayerFunds() public {
        bytes32 nonce = keccak256("arc-fork-blocked");
        vm.expectRevert(bytes("Blocked address"));
        this.payExternally(blockedMerchantId, nonce);

        assertEq(ARC_USDC.balanceOf(payer), 100_000_000, "payer keeps funds");
        assertEq(ARC_USDC.balanceOf(address(payments)), 0, "no residue");
        assertFalse(ARC_USDC.authorizationState(payer, nonce), "nonce not burnt");
    }

    function test_contractWalletPaysInArcUsdc() public {
        (address owner, uint256 ownerPk) = makeAddrAndKey("walletOwner");
        MockErc1271Wallet wallet = new MockErc1271Wallet(owner);
        vm.deal(address(wallet), 100 ether);
        bytes32 nonce = keccak256("arc-fork-wallet");
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: address(wallet),
            amount: AMOUNT,
            validAfter: block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce
        });
        bytes32 ref = keccak256("arc-fork-wallet-ref");
        (uint8 v, bytes32 r, bytes32 s) = _signArcReceiveWithAuthorization(
            ownerPk, auth.from, address(payments), auth.amount, auth.validAfter, auth.validBefore, nonce
        );
        bytes memory authSig = abi.encodePacked(r, s, v);
        (v, r, s) = _signPayIntent(
            payments, ownerPk, merchantId, address(ARC_USDC), auth.amount, nonce, auth.validBefore, ref
        );

        payments.payWithAuthorization(merchantId, address(ARC_USDC), auth, ref, authSig, abi.encodePacked(r, s, v));

        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(ARC_USDC.balanceOf(merchantPayout), AMOUNT - fee, "merchant net");
        assertEq(ARC_USDC.balanceOf(address(wallet)), 100_000_000 - AMOUNT, "wallet debited");
        assertTrue(ARC_USDC.authorizationState(address(wallet), nonce), "nonce burnt");
    }

    function payExternally(uint256 mid, bytes32 nonce) external {
        _pay(mid, nonce);
    }
}
