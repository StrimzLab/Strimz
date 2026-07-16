// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, StdInvariant } from "forge-std/Test.sol";
import { StrimzTestBase } from "../Helpers.t.sol";
import { StrimzRegistry } from "../../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../../src/access/StrimzAccessControl.sol";
import { IStrimzPayments } from "../../src/interfaces/IStrimzPayments.sol";
import { MockUsdc } from "../Helpers.t.sol";

/// @dev A bounded-action handler that drives random calls into Payments
///      under realistic preconditions (whitelisted token, registered
///      merchant, funded payer, valid approval). Without this handler the
///      raw fuzzer cannot satisfy the call's preconditions and reports
///      "no contracts to fuzz".
///
///      The handler exposes BOTH payment entrypoints — `pay` (classic
///      approve+pay) and `payWithAuthorization` (EIP-3009 meta-tx) — so
///      the invariants cover the combined state space and rule out
///      double-credit between the two paths.
contract PaymentsHandler is Test {
    StrimzPayments public immutable PAYMENTS;
    MockUsdc public immutable USDC;
    uint256 public immutable MERCHANT_ID;
    uint16 public immutable FEE_BPS;

    address[3] internal payers;
    uint256[3] internal payerKeys;

    /// @dev Ghost variables that mirror the on-chain state we expect the
    ///      contracts to produce. Updated only on confirmed-successful
    ///      paths; a failed try-catch must not move them.
    uint256 public ghostTotalIngressed;
    uint256 public ghostTotalExpectedFees;
    uint256 public ghostCallCount;

    constructor(StrimzPayments _payments, MockUsdc _usdc, uint256 _merchantId, uint16 _feeBps) {
        PAYMENTS = _payments;
        USDC = _usdc;
        MERCHANT_ID = _merchantId;
        FEE_BPS = _feeBps;

        // makeAddrAndKey is deterministic in `name`, so the handler stores
        // both halves up-front. The same addresses would be produced by
        // `makeAddr` — we need the keys so EIP-3009 paths can sign.
        (payers[0], payerKeys[0]) = makeAddrAndKey("invariant.payer.0");
        (payers[1], payerKeys[1]) = makeAddrAndKey("invariant.payer.1");
        (payers[2], payerKeys[2]) = makeAddrAndKey("invariant.payer.2");
        for (uint256 i = 0; i < payers.length; i++) {
            USDC.mint(payers[i], 1_000_000_000_000);
        }
    }

    function pay(uint8 payerIdx, uint128 amountIn) external {
        ghostCallCount++;
        address payer = payers[payerIdx % payers.length];
        uint256 capped = (uint256(amountIn) % 100_000_000_000) + 1;

        vm.prank(payer);
        USDC.approve(address(PAYMENTS), capped);

        uint256 expectedFee = (capped * FEE_BPS) / 10_000;
        vm.prank(payer);
        try PAYMENTS.pay(MERCHANT_ID, address(USDC), capped, bytes32(0)) {
            ghostTotalIngressed += capped;
            ghostTotalExpectedFees += expectedFee;
        } catch { }
    }

    function payWithAuthorization(uint8 payerIdx, uint128 amountIn) external {
        ghostCallCount++;
        uint256 idx = payerIdx % payers.length;
        address payer = payers[idx];
        uint256 pk = payerKeys[idx];
        uint256 capped = (uint256(amountIn) % 100_000_000_000) + 1;

        IStrimzPayments.PayAuthorization memory auth = IStrimzPayments.PayAuthorization({
            from: payer,
            amount: capped,
            validAfter: block.timestamp == 0 ? 0 : block.timestamp - 1,
            validBefore: block.timestamp + 1 hours,
            // Per-call unique nonce. ghostCallCount is monotone so the
            // fuzzer cannot accidentally produce a replay collision and
            // mask a real double-credit bug.
            nonce: keccak256(abi.encodePacked("inv.nonce", ghostCallCount))
        });
        (uint8 authV, bytes32 authR, bytes32 authS) = _signReceive(pk, auth);
        (uint8 intV, bytes32 intR, bytes32 intS) =
            _signIntent(pk, auth, bytes32(0));

        uint256 expectedFee = (capped * FEE_BPS) / 10_000;
        // Anyone may submit — relayer pattern. Handler is the submitter.
        try PAYMENTS.payWithAuthorization(
            MERCHANT_ID,
            address(USDC),
            auth,
            bytes32(0),
            IStrimzPayments.Sig(authV, authR, authS),
            IStrimzPayments.Sig(intV, intR, intS)
        ) {
            ghostTotalIngressed += capped;
            ghostTotalExpectedFees += expectedFee;
        } catch { }
    }

    function _signIntent(
        uint256 pk,
        IStrimzPayments.PayAuthorization memory auth,
        bytes32 ref
    ) private view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 digest = PAYMENTS.payIntentDigest(
            MERCHANT_ID, address(USDC), auth.amount, auth.nonce, auth.validBefore, ref
        );
        (v, r, s) = vm.sign(pk, digest);
    }

    function _signReceive(uint256 pk, IStrimzPayments.PayAuthorization memory auth)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                USDC.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                auth.from,
                address(PAYMENTS),
                auth.amount,
                auth.validAfter,
                auth.validBefore,
                auth.nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", USDC.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }
}

/// @dev Invariants on the combined Payments state space (both pay() and
///      payWithAuthorization()):
///
///        1. The FeeCollector's ERC20 balance is bounded by the total fee
///           it has been credited with — no value leaks out without a
///           TREASURY_ROLE withdrawal.
///
///        2. The Payments contract holds zero token balance at rest —
///           every entrypoint is pull-then-forward in the same call; any
///           residue would mean a path failed to forward.
///
///        3. The FeeCollector's accrued total exactly equals the sum of
///           expected fees across every successful call from either path.
///           If the same auth/approval were ever double-credited, this
///           equality would break.
///
///        4. The merchant payout balance exactly equals the sum of net
///           amounts (gross − fee) across every successful call. Same
///           double-credit safeguard, applied to the merchant side.
contract PaymentsInvariantsTest is StdInvariant, StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    PaymentsHandler internal handler;
    uint16 internal constant FEE_BPS = 200;

    function setUp() public {
        _setUpTokens();
        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        // Both bits — the EIP-3009 path needs CAP_TRANSFER_AUTH_3009;
        // CAP_PERMIT_2612 is set defensively even though Payments doesn't
        // use it, so the whitelist's state mirrors production for real USDC.
        whitelist.setCapabilities(
            address(usdc),
            whitelist.CAP_TRANSFER_AUTH_3009() | whitelist.CAP_PERMIT_2612()
        );
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(payments)
        );
        uint256 mid = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopPrank();

        handler = new PaymentsHandler(payments, usdc, mid, FEE_BPS);
        targetContract(address(handler));
    }

    function invariant_feeCollectorBalanceBoundedByAccrued() public view {
        assertLe(usdc.balanceOf(address(feeCollector)), feeCollector.totalAccrued(address(usdc)));
    }

    function invariant_paymentsContractHoldsNoResidue() public view {
        assertEq(
            usdc.balanceOf(address(payments)),
            0,
            "Payments must drain to FeeCollector + merchantPayout in the same call"
        );
    }

    function invariant_accruedEqualsGhostFees() public view {
        assertEq(
            feeCollector.totalAccrued(address(usdc)),
            handler.ghostTotalExpectedFees(),
            "FeeCollector accrued must equal the sum of expected fees across both paths"
        );
    }

    function invariant_merchantBalanceEqualsGhostNet() public view {
        uint256 expectedNet = handler.ghostTotalIngressed() - handler.ghostTotalExpectedFees();
        assertEq(
            usdc.balanceOf(merchantPayout),
            expectedNet,
            "Merchant payout balance must equal sum of net amounts across both paths"
        );
    }
}
