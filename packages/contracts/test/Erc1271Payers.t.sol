// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase, MockUsdc, MockErc1271Wallet } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

contract Erc1271PayersTest is StrimzTestBase {
    uint16 internal constant FEE_BPS = 100;
    uint256 internal constant AMOUNT = 50_000_000;
    uint32 internal constant INTERVAL = 1 hours;
    bytes32 internal constant REF = "ref";
    bytes32 internal constant INTENT_NONCE = keccak256("intent");

    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;

    address internal relayer;
    address internal walletOwner;
    uint256 internal walletOwnerPk;
    MockErc1271Wallet internal wallet;

    function setUp() public {
        relayer = makeAddr("relayer");
        (walletOwner, walletOwnerPk) = makeAddrAndKey("walletOwner");
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        bytes32 accruerRole = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();
        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(
            address(usdc), whitelist.CAP_TRANSFER_AUTH_3009() | whitelist.CAP_PERMIT_2612()
        );
        feeCollector.grantRole(accruerRole, address(payments));
        feeCollector.grantRole(accruerRole, address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, FEE_BPS, 0);
        vm.stopPrank();

        wallet = new MockErc1271Wallet(walletOwner);
        _fund(address(wallet), 1_000_000_000);
        _fund(payer, 1_000_000_000);
    }

    // ---------- Helpers ----------

    function _auth(address from, bytes32 nonce) internal view returns (IStrimzPayments.PayAuthorization memory) {
        return IStrimzPayments.PayAuthorization({
            from: from,
            amount: AMOUNT,
            validAfter: block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce
        });
    }

    function _authSig(IStrimzPayments.PayAuthorization memory a, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveWithAuthorization(
            usdc, pk, a.from, address(payments), a.amount, a.validAfter, a.validBefore, a.nonce
        );
        return abi.encodePacked(r, s, v);
    }

    function _payIntentSig(IStrimzPayments.PayAuthorization memory a, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            _signPayIntent(payments, pk, merchantId, address(usdc), a.amount, a.nonce, a.validBefore, REF);
        return abi.encodePacked(r, s, v);
    }

    function _pay(IStrimzPayments.PayAuthorization memory a, bytes memory authSig, bytes memory intentSig) internal {
        vm.prank(relayer);
        payments.payWithAuthorization(merchantId, address(usdc), a, REF, authSig, intentSig);
    }

    function _permit(address owner, uint256 deadline) internal pure returns (IStrimzSubscriptions.PermitData memory) {
        return IStrimzSubscriptions.PermitData({ owner: owner, value: type(uint256).max, deadline: deadline });
    }

    function _permitSig(IStrimzSubscriptions.PermitData memory pd, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(usdc, pk, pd.owner, address(subs), pd.value, pd.deadline);
        return abi.encodePacked(r, s, v);
    }

    function _subIntentSig(uint256 pk, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signSubscriptionIntent(
            subs, pk, merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, deadline, type(uint256).max, INTENT_NONCE
        );
        return abi.encodePacked(r, s, v);
    }

    function _subscribe(IStrimzSubscriptions.PermitData memory pd, bytes memory permitSig, bytes memory intentSig)
        internal
        returns (uint256)
    {
        vm.prank(relayer);
        return subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, INTENT_NONCE, pd, permitSig, intentSig
        );
    }

    function _yParity(bytes memory sig) internal pure returns (bytes memory) {
        sig[64] = bytes1(uint8(sig[64]) - 27);
        return sig;
    }

    function _compact(bytes memory sig) internal pure returns (bytes memory out) {
        out = new bytes(64);
        for (uint256 i; i < 64; ++i) out[i] = sig[i];
    }

    // ---------- Payments: contract wallets ----------

    function test_contractWalletPays() public {
        IStrimzPayments.PayAuthorization memory a = _auth(address(wallet), keccak256("w-1"));
        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;

        vm.expectEmit(true, true, true, true, address(payments));
        emit IStrimzPayments.PaymentExecuted(merchantId, address(wallet), address(usdc), AMOUNT, fee, AMOUNT - fee, REF);
        _pay(a, _authSig(a, walletOwnerPk), _payIntentSig(a, walletOwnerPk));

        assertEq(usdc.balanceOf(merchantPayout), AMOUNT - fee);
        assertEq(usdc.balanceOf(address(feeCollector)), fee);
        assertEq(usdc.balanceOf(address(wallet)), 1_000_000_000 - AMOUNT);
        assertTrue(usdc.authorizationState(address(wallet), a.nonce));
    }

    function test_contractWalletPaysWithOnChainApprovedHashes() public {
        IStrimzPayments.PayAuthorization memory a = _auth(address(wallet), keccak256("w-approved"));
        wallet.approveHash(payments.payIntentDigest(merchantId, address(usdc), AMOUNT, a.nonce, a.validBefore, REF));
        wallet.approveHash(_receiveDigest(a));

        _pay(a, "", "");

        assertEq(usdc.balanceOf(address(wallet)), 1_000_000_000 - AMOUNT);
    }

    function test_contractWalletIntentFromAnotherKeyReverts() public {
        IStrimzPayments.PayAuthorization memory a = _auth(address(wallet), keccak256("w-bad-intent"));
        (, uint256 otherPk) = makeAddrAndKey("other");
        bytes memory authSig = _authSig(a, walletOwnerPk);
        bytes memory intentSig = _payIntentSig(a, otherPk);

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidIntent.selector);
        payments.payWithAuthorization(merchantId, address(usdc), a, REF, authSig, intentSig);
    }

    function test_contractWalletAuthFromAnotherKeyRevertsInToken() public {
        IStrimzPayments.PayAuthorization memory a = _auth(address(wallet), keccak256("w-bad-auth"));
        (, uint256 otherPk) = makeAddrAndKey("other");
        bytes memory authSig = _authSig(a, otherPk);
        bytes memory intentSig = _payIntentSig(a, walletOwnerPk);

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__InvalidSignature.selector);
        payments.payWithAuthorization(merchantId, address(usdc), a, REF, authSig, intentSig);
    }

    // ---------- Payments: EOAs keep the v, r, s path ----------

    function test_eoaPaysThroughTheVrsOverload() public {
        IStrimzPayments.PayAuthorization memory a = _auth(payer, keccak256("e-1"));
        bytes memory authSig = _authSig(a, payerPk);
        (bytes32 r, bytes32 s) = _rs(authSig);

        vm.expectCall(
            address(usdc),
            abi.encodeWithSignature(
                "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
                payer, address(payments), AMOUNT, a.validAfter, a.validBefore, a.nonce, uint8(authSig[64]), r, s
            )
        );
        _pay(a, authSig, _payIntentSig(a, payerPk));

        assertEq(usdc.balanceOf(payer), 1_000_000_000 - AMOUNT);
    }

    function test_eoaSignaturesWithYParityV() public {
        IStrimzPayments.PayAuthorization memory a = _auth(payer, keccak256("e-parity"));

        _pay(a, _yParity(_authSig(a, payerPk)), _yParity(_payIntentSig(a, payerPk)));

        assertEq(usdc.balanceOf(payer), 1_000_000_000 - AMOUNT);
    }

    function test_eoaAuthSignatureOfWrongLengthReverts() public {
        IStrimzPayments.PayAuthorization memory a = _auth(payer, keccak256("e-short"));
        bytes memory authSig = _compact(_authSig(a, payerPk));
        bytes memory intentSig = _payIntentSig(a, payerPk);

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidSignature.selector);
        payments.payWithAuthorization(merchantId, address(usdc), a, REF, authSig, intentSig);
    }

    function test_eoaIntentSignatureOfWrongLengthReverts() public {
        IStrimzPayments.PayAuthorization memory a = _auth(payer, keccak256("e-short-intent"));
        bytes memory authSig = _authSig(a, payerPk);
        bytes memory intentSig = _compact(_payIntentSig(a, payerPk));

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidIntent.selector);
        payments.payWithAuthorization(merchantId, address(usdc), a, REF, authSig, intentSig);
    }

    // ---------- Subscriptions ----------

    function test_contractWalletSubscribesAndIsCharged() public {
        uint256 deadline = block.timestamp + 1 hours;
        IStrimzSubscriptions.PermitData memory pd = _permit(address(wallet), deadline);

        uint256 id = _subscribe(pd, _permitSig(pd, walletOwnerPk), _subIntentSig(walletOwnerPk, deadline));

        assertEq(subs.getSubscription(id).payer, address(wallet));
        assertEq(usdc.allowance(address(wallet), address(subs)), type(uint256).max);

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        bytes32[] memory attempts = new bytes32[](1);
        attempts[0] = keccak256("attempt-1");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory out = subs.batchCharge(ids, attempts);

        assertEq(uint8(out[0]), uint8(IStrimzSubscriptions.ChargeOutcome.Charged));
        assertEq(usdc.balanceOf(merchantPayout), AMOUNT - (AMOUNT * FEE_BPS) / 10_000);
    }

    function test_contractWalletSubscriptionIntentFromAnotherKeyReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        IStrimzSubscriptions.PermitData memory pd = _permit(address(wallet), deadline);
        (, uint256 otherPk) = makeAddrAndKey("other");
        bytes memory permitSig = _permitSig(pd, walletOwnerPk);
        bytes memory intentSig = _subIntentSig(otherPk, deadline);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, INTENT_NONCE, pd, permitSig, intentSig
        );
    }

    function test_eoaPermitsThroughTheVrsOverload() public {
        uint256 deadline = block.timestamp + 1 hours;
        IStrimzSubscriptions.PermitData memory pd = _permit(payer, deadline);
        bytes memory permitSig = _permitSig(pd, payerPk);
        (bytes32 r, bytes32 s) = _rs(permitSig);

        vm.expectCall(
            address(usdc),
            abi.encodeWithSignature(
                "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
                payer, address(subs), pd.value, deadline, uint8(permitSig[64]), r, s
            )
        );
        _subscribe(pd, _yParity(permitSig), _yParity(_subIntentSig(payerPk, deadline)));

        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max);
    }

    function test_eoaPermitSignatureOfWrongLengthReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        IStrimzSubscriptions.PermitData memory pd = _permit(payer, deadline);
        bytes memory permitSig = _compact(_permitSig(pd, payerPk));
        bytes memory intentSig = _subIntentSig(payerPk, deadline);

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidSignature.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0, INTENT_NONCE, pd, permitSig, intentSig
        );
    }

    // ---------- Digest helpers ----------

    function _receiveDigest(IStrimzPayments.PayAuthorization memory a) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            usdc.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
            a.from, address(payments), a.amount, a.validAfter, a.validBefore, a.nonce
        ));
        return keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
    }

    function _rs(bytes memory sig) internal pure returns (bytes32 r, bytes32 s) {
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
        }
    }
}
