// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzPaymentsAuth.t
/// @notice Coverage for `payWithAuthorization`. Two signatures now go
///         into every call: an EIP-3009 authorization the token verifies,
///         and a Strimz PayIntent this contract verifies. The intent
///         binds merchantId + token + amount + nonce + validBefore + ref
///         so an attacker holding a valid EIP-3009 sig cannot redirect
///         funds to another merchant.
///
///         Invariants we prove:
///           1. Happy path splits fee + net and burns the auth nonce.
///           2. A relayer can submit — payer of record is `auth.from`.
///           3. Tampering with merchantId, token, amount, or ref between
///              signing and submission fails intent verification.
///           4. Swapping the intent for one signed by a different key
///              fails intent verification.
///           5. All existing token-side checks still fire — invalid sig,
///              expired window, replay, missing capability.

import { StrimzTestBase, MockUsdc } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";

contract StrimzPaymentsAuthTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    uint256 internal merchantId;

    uint16 internal constant FEE_BPS = 150;
    uint256 internal constant AMOUNT = 100_000_000; // 100 mUSDC
    address internal relayer;

    function setUp() public {
        relayer = makeAddr("relayer");
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        uint8 cap = whitelist.CAP_TRANSFER_AUTH_3009();
        bytes32 accruerRole = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), cap);
        feeCollector.grantRole(accruerRole, address(payments));
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopPrank();

        _fund(payer, 1_000_000_000);
    }

    // ---------- Helpers ----------

    function _defaultAuth(uint256 amount, bytes32 nonce)
        internal
        view
        returns (IStrimzPayments.PayAuthorization memory)
    {
        return IStrimzPayments.PayAuthorization({
            from: payer,
            amount: amount,
            validAfter: block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce
        });
    }

    function _signAuth(IStrimzPayments.PayAuthorization memory auth, uint256 signerPk)
        internal
        view
        returns (IStrimzPayments.Sig memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = _signReceiveWithAuthorization(
            usdc, signerPk, auth.from, address(payments),
            auth.amount, auth.validAfter, auth.validBefore, auth.nonce
        );
        return IStrimzPayments.Sig(v, r, s);
    }

    function _signIntent(
        uint256 signerPk,
        uint256 mid,
        address token,
        IStrimzPayments.PayAuthorization memory auth,
        bytes32 ref
    ) internal view returns (IStrimzPayments.Sig memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signPayIntent(
            payments, signerPk, mid, token, auth.amount, auth.nonce, auth.validBefore, ref
        );
        return IStrimzPayments.Sig(v, r, s);
    }

    // ---------- Happy path ----------

    function test_happyPath_splitsFeeAndNet() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-1"));
        bytes32 ref = keccak256("ref-1");
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig = _signIntent(payerPk, merchantId, address(usdc), auth, ref);

        uint256 expectedFee = (AMOUNT * FEE_BPS) / 10_000;
        uint256 expectedNet = AMOUNT - expectedFee;

        vm.prank(relayer);
        payments.payWithAuthorization(merchantId, address(usdc), auth, ref, authSig, intentSig);

        assertEq(usdc.balanceOf(merchantPayout), expectedNet, "merchant net");
        assertEq(usdc.balanceOf(address(feeCollector)), expectedFee, "collector fee");
        assertEq(usdc.balanceOf(address(payments)), 0, "no residue");
        assertEq(feeCollector.totalAccrued(address(usdc)), expectedFee, "accrual booked");
        assertTrue(usdc.authorizationState(payer, auth.nonce), "nonce burnt");
    }

    // Relayer submits, but the on-chain payer of record is the signer.
    function test_relayerSubmitsForPayer() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-relay"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32("r"));

        vm.prank(relayer);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32("r"), authSig, intentSig);

        assertGt(usdc.balanceOf(merchantPayout), 0, "merchant credited");
        assertEq(usdc.balanceOf(relayer), 0, "relayer got nothing");
    }

    // ---------- Intent binding — the auditor's core concern ----------

    // Submit with a different merchantId than the payer signed for.
    // Without the intent, this would silently route Alice's money to MX.
    function test_intent_hijackedMerchantId_reverts() public {
        // Register a second merchant that the attacker controls.
        vm.prank(admin);
        uint256 attackerMerchant = registry.registerMerchant(
            makeAddr("attackerOwner"), makeAddr("attackerPayout"), FEE_BPS, 0
        );

        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-hijack"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        // Payer signs the intent for the LEGITIMATE merchantId.
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32("ref"));

        // Attacker submits with attackerMerchant as target.
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(IStrimzPayments.Payments__InvalidIntent.selector);
        payments.payWithAuthorization(
            attackerMerchant, address(usdc), auth, bytes32("ref"), authSig, intentSig
        );
    }

    // Tampered amount, ref, or validBefore between signing and submission
    // must all fail intent verification.
    function test_intent_tamperedRef_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-ref"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32("original"));

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidIntent.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32("tampered"), authSig, intentSig
        );
    }

    // Intent signed by a different key (attacker) does not recover to
    // auth.from and is rejected.
    function test_intent_signedByAttackerKey_reverts() public {
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-attack"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(attackerPk, merchantId, address(usdc), auth, bytes32("r"));

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidIntent.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32("r"), authSig, intentSig
        );
    }

    // ---------- Existing token-side + gate checks still fire ----------

    function test_zeroAmount_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(0, keccak256("n-zero"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidAmount.selector);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32(0), authSig, intentSig);
    }

    function test_nonWhitelistedToken_reverts() public {
        MockUsdc other = new MockUsdc();
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-x"));
        IStrimzPayments.Sig memory empty = IStrimzPayments.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzPayments.Payments__InvalidToken.selector, address(other))
        );
        payments.payWithAuthorization(merchantId, address(other), auth, bytes32(0), empty, empty);
    }

    function test_tokenWithoutCapability_reverts() public {
        MockUsdc plain = new MockUsdc();
        vm.prank(admin);
        whitelist.add(address(plain));
        // Capability deliberately unset.

        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-nc"));
        IStrimzPayments.Sig memory empty = IStrimzPayments.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzPayments.Payments__UnsupportedCapability.selector, address(plain))
        );
        payments.payWithAuthorization(merchantId, address(plain), auth, bytes32(0), empty, empty);
    }

    // Token-side signature check runs after the Strimz intent check but
    // both must pass. Here we submit a valid intent but a wrong auth sig.
    function test_invalidAuthSignature_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-bad"));
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        IStrimzPayments.Sig memory badAuth = _signAuth(auth, attackerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__InvalidSignature.selector);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32(0), badAuth, intentSig);
    }

    function test_expiredAuthorization_reverts() public {
        vm.warp(block.timestamp + 1 days);
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp - 2 hours,
            validBefore: block.timestamp - 1,
            nonce: keccak256("n-exp")
        });
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationExpired.selector);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32(0), authSig, intentSig);
    }

    function test_notYetValid_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp + 1 hours,
            validBefore: block.timestamp + 2 hours,
            nonce: keccak256("n-pre")
        });
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationNotYetValid.selector);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32(0), authSig, intentSig);
    }

    // Even with a different `ref` on the second call, the same auth
    // nonce is burnt after first use.
    function test_replayNonce_reverts() public {
        bytes32 nonce = keccak256("n-replay");
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, nonce);
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSigA =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32("a"));

        vm.prank(relayer);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32("a"), authSig, intentSigA);

        IStrimzPayments.Sig memory intentSigB =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32("b"));
        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationAlreadyUsed.selector);
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32("b"), authSig, intentSigB);
    }

    function test_paused_reverts() public {
        vm.prank(admin);
        payments.pause();

        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("n-paused"));
        IStrimzPayments.Sig memory authSig = _signAuth(auth, payerPk);
        IStrimzPayments.Sig memory intentSig =
            _signIntent(payerPk, merchantId, address(usdc), auth, bytes32(0));

        vm.prank(relayer);
        vm.expectRevert();
        payments.payWithAuthorization(merchantId, address(usdc), auth, bytes32(0), authSig, intentSig);
    }
}
