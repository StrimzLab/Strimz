// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase, MockUsdc } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../src/interfaces/IStrimzPayments.sol";

/// @title StrimzPaymentsAuthTest
/// @notice Coverage for the EIP-3009 `payWithAuthorization` entrypoint.
///         Asserts the path-specific invariants — capability gating,
///         signature recovery, nonce replay protection, validity-window
///         enforcement — without re-litigating the fee-split arithmetic
///         (that's covered by `StrimzPayments.t.sol` against `pay()`).
contract StrimzPaymentsAuthTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    uint256 internal merchantId;

    uint16 internal constant FEE_BPS = 150;
    uint256 internal constant AMOUNT = 100_000_000; // 100 mUSDC
    /// @dev Any address — proves a relayer (not the payer) can submit.
    address internal relayer;

    function setUp() public {
        relayer = makeAddr("relayer");
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), whitelist.CAP_TRANSFER_AUTH_3009());
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(payments)
        );
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopPrank();

        _fund(payer, 1_000_000_000);
        // No `usdc.approve` — EIP-3009 doesn't use the ERC20 allowance path.
    }

    // ----- Helpers -----

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

    function _sign(IStrimzPayments.PayAuthorization memory auth, uint256 signerPk)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        return _signReceiveWithAuthorization(
            usdc,
            signerPk,
            auth.from,
            address(payments),
            auth.amount,
            auth.validAfter,
            auth.validBefore,
            auth.nonce
        );
    }

    // ----- Happy path -----

    function test_payWithAuthorization_happyPath_splitsFeeAndNet() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-1"));
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        uint256 expectedFee = (AMOUNT * FEE_BPS) / 10_000;
        uint256 expectedNet = AMOUNT - expectedFee;

        vm.expectEmit(true, true, true, true, address(payments));
        emit IStrimzPayments.PaymentExecuted(
            merchantId, payer, address(usdc), AMOUNT, expectedFee, expectedNet, keccak256("ref-1")
        );

        vm.prank(relayer);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, keccak256("ref-1"), v, r, s
        );

        assertEq(usdc.balanceOf(merchantPayout), expectedNet, "merchant net");
        assertEq(usdc.balanceOf(address(feeCollector)), expectedFee, "collector fee");
        assertEq(usdc.balanceOf(address(payments)), 0, "no residue in payments");
        assertEq(feeCollector.totalAccrued(address(usdc)), expectedFee, "accrued credited");
        assertTrue(usdc.authorizationState(payer, keccak256("nonce-1")), "nonce marked used");
    }

    function test_payWithAuthorization_relayerSubmitsForPayer() public {
        // The payer signs but never broadcasts — the relayer pays gas and
        // calls. This is the central meta-tx property: the on-chain
        // payer-of-record is `auth.from`, not `msg.sender`.
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-relay"));
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, keccak256("ref"), v, r, s
        );

        assertGt(usdc.balanceOf(merchantPayout), 0, "merchant credited");
        assertEq(usdc.balanceOf(relayer), 0, "relayer not credited");
    }

    // ----- Path-specific reverts -----

    function test_payWithAuthorization_zeroAmount_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(0, keccak256("nonce-zero"));
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        vm.expectRevert(IStrimzPayments.Payments__InvalidAmount.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(0), v, r, s
        );
    }

    function test_payWithAuthorization_nonWhitelistedToken_reverts() public {
        MockUsdc other = new MockUsdc();
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-x"));
        // Signature doesn't matter — the whitelist check runs first.

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzPayments.Payments__InvalidToken.selector, address(other))
        );
        payments.payWithAuthorization(
            merchantId, address(other), auth, bytes32(0), 27, bytes32(0), bytes32(0)
        );
    }

    function test_payWithAuthorization_tokenWithoutCapability_reverts() public {
        // A second token is whitelisted but has CAP_TRANSFER_AUTH_3009
        // unset. The function must refuse to call its non-existent (or
        // worse, unintended) `receiveWithAuthorization` fallback.
        MockUsdc plain = new MockUsdc();
        vm.startPrank(admin);
        whitelist.add(address(plain));
        // Deliberately NOT calling setCapabilities here.
        vm.stopPrank();

        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-noc"));

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzPayments.Payments__UnsupportedCapability.selector, address(plain)
            )
        );
        payments.payWithAuthorization(
            merchantId, address(plain), auth, bytes32(0), 27, bytes32(0), bytes32(0)
        );
    }

    function test_payWithAuthorization_invalidSignature_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-bad"));
        // Sign with the WRONG key — recovered signer won't match `auth.from`.
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, attackerPk);

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__InvalidSignature.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(0), v, r, s
        );
    }

    function test_payWithAuthorization_expiredAuthorization_reverts() public {
        // Warp forward so we have headroom to express a past validBefore.
        vm.warp(block.timestamp + 1 days);
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp - 2 hours,
            validBefore: block.timestamp - 1, // already past
            nonce: keccak256("nonce-exp")
        });
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationExpired.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(0), v, r, s
        );
    }

    function test_payWithAuthorization_notYetValid_reverts() public {
        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: AMOUNT,
            validAfter: block.timestamp + 1 hours,
            validBefore: block.timestamp + 2 hours,
            nonce: keccak256("nonce-pre")
        });
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationNotYetValid.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(0), v, r, s
        );
    }

    function test_payWithAuthorization_replayNonce_reverts() public {
        bytes32 nonce = keccak256("nonce-replay");
        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, nonce);
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, keccak256("ref-once"), v, r, s
        );

        // Replay with the same nonce — even with a different ref — must fail.
        vm.prank(relayer);
        vm.expectRevert(MockUsdc.MockUsdc__AuthorizationAlreadyUsed.selector);
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, keccak256("ref-twice"), v, r, s
        );
    }

    function test_payWithAuthorization_paused_reverts() public {
        vm.prank(admin);
        payments.pause();

        IStrimzPayments.PayAuthorization memory auth = _defaultAuth(AMOUNT, keccak256("nonce-paused"));
        (uint8 v, bytes32 r, bytes32 s) = _sign(auth, payerPk);

        vm.prank(relayer);
        vm.expectRevert();
        payments.payWithAuthorization(
            merchantId, address(usdc), auth, bytes32(0), v, r, s
        );
    }
}
