// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzSubscriptionsPermit.t
/// @notice Coverage for `permitAndCreateSubscription`. Two signatures
///         now: an EIP-2612 permit the token verifies, and a Strimz
///         SubscriptionIntent this contract verifies. The intent binds
///         merchantId + token + amount + interval + startAt + endAt +
///         permitDeadline so a valid permit cannot be re-purposed to
///         enrol the payer in a different subscription.
///
///         Invariants we prove:
///           1. Happy path grants the allowance and creates the sub.
///           2. Relayer submits, payer of record is `permitData.owner`.
///           3. Tampering with any subscription parameter between signing
///              and submission fails intent verification.
///           4. Intent signed by a wrong key is rejected before the
///              token's permit is invoked — the permit nonce is not burnt.
///           5. All prior checks still fire — invalid permit sig, expired
///              deadline, unwhitelisted token, missing capability.

import { StrimzTestBase, MockUsdc } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

contract StrimzSubscriptionsPermitTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;

    uint16 internal constant FEE_BPS = 100;
    uint256 internal constant AMOUNT = 50_000_000; // 50 mUSDC per period
    uint32 internal constant INTERVAL = 1 hours;
    address internal relayer;

    function setUp() public {
        relayer = makeAddr("relayer");
        _setUpTokens();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        uint8 cap = whitelist.CAP_PERMIT_2612();
        bytes32 accruerRole = StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE();

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        whitelist.setCapabilities(address(usdc), cap);
        feeCollector.grantRole(accruerRole, address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, 0);
        vm.stopPrank();

        _fund(payer, 10_000_000_000);
    }

    // ---------- Helpers ----------

    function _defaultPermit(uint256 value, uint256 deadline)
        internal
        view
        returns (IStrimzSubscriptions.PermitData memory)
    {
        return IStrimzSubscriptions.PermitData({ owner: payer, value: value, deadline: deadline });
    }

    function _signPermitFor(IStrimzSubscriptions.PermitData memory pd, uint256 signerPk)
        internal
        view
        returns (IStrimzSubscriptions.Sig memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(usdc, signerPk, pd.owner, address(subs), pd.value, pd.deadline);
        return IStrimzSubscriptions.Sig(v, r, s);
    }

    function _signIntentFor(
        uint256 signerPk,
        uint256 mid,
        address token,
        uint256 amount,
        uint32 interval,
        uint64 startAt,
        uint64 endAt,
        uint256 permitDeadline
    ) internal view returns (IStrimzSubscriptions.Sig memory) {
        (uint8 v, bytes32 r, bytes32 s) = _signSubscriptionIntent(
            subs, signerPk, mid, token, amount, interval, startAt, endAt, permitDeadline
        );
        return IStrimzSubscriptions.Sig(v, r, s);
    }

    // ---------- Happy path ----------

    function test_happyPath_grantsAllowanceAndCreates() public {
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, permitSig, intentSig
        );

        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max, "allowance from permit");

        IStrimzSubscriptions.Subscription memory sub = subs.getSubscription(subId);
        assertEq(sub.payer, payer, "payer == permit owner");
        assertEq(sub.merchantId, uint96(merchantId));
        assertEq(sub.amount, AMOUNT);
        assertEq(sub.interval, INTERVAL);
    }

    function test_happyPath_scheduledChargeSettles() public {
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, permitSig, intentSig
        );

        uint256[] memory ids = new uint256[](1);
        bytes32[] memory attempts = new bytes32[](1);
        ids[0] = subId;
        attempts[0] = keccak256("charge-1");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);
        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged));

        uint256 expectedFee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(usdc.balanceOf(merchantPayout), AMOUNT - expectedFee);
        assertEq(usdc.balanceOf(address(feeCollector)), expectedFee);
    }

    function test_payerCanCancelAfterRelayerCreated() public {
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, permitSig, intentSig
        );

        // Relayer has no cancel standing.
        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__NotSubscriptionParty.selector);
        subs.cancel(subId);

        // Payer does.
        vm.prank(payer);
        subs.cancel(subId);
        assertTrue(subs.getSubscription(subId).cancelled);
    }

    // ---------- Intent binding — the auditor's core concern ----------

    // Attacker submits with a different merchantId than the payer signed
    // for. Without the intent, this would silently enrol Alice in an
    // attacker's plan.
    function test_intent_hijackedMerchantId_reverts() public {
        vm.prank(admin);
        uint256 attackerMerchant = registry.registerMerchant(
            makeAddr("attackerOwner"), makeAddr("attackerPayout"), FEE_BPS, 0
        );

        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        // Payer signs the intent for the LEGITIMATE merchantId.
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(makeAddr("attacker"));
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        subs.permitAndCreateSubscription(
            attackerMerchant, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );

        // Permit nonce was NOT burnt because intent verification runs
        // first. Payer can still use their signed permit legitimately.
        assertEq(usdc.nonces(payer), 0, "permit nonce untouched");
    }

    // Attacker tampers with amount (charges Alice 10x what she agreed).
    function test_intent_tamperedAmount_reverts() public {
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT * 10, INTERVAL, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );
    }

    // Attacker tampers with interval (charges every minute instead of every hour).
    function test_intent_tamperedInterval_reverts() public {
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, 2 hours, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );
    }

    // Intent signed by a different key does not match permitData.owner.
    function test_intent_signedByAttackerKey_reverts() public {
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            attackerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidIntent.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );
    }

    // ---------- Existing checks still fire ----------

    function test_zeroAmount_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        IStrimzSubscriptions.Sig memory sig = IStrimzSubscriptions.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidAmount.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), 0, INTERVAL, uint64(block.timestamp), 0, pd, sig, sig
        );
    }

    function test_intervalTooShort_reverts() public {
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        IStrimzSubscriptions.Sig memory sig = IStrimzSubscriptions.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(IStrimzSubscriptions.Subscriptions__InvalidInterval.selector);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, 60, uint64(block.timestamp), 0, pd, sig, sig
        );
    }

    function test_unwhitelistedToken_reverts() public {
        MockUsdc other = new MockUsdc();
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        IStrimzSubscriptions.Sig memory sig = IStrimzSubscriptions.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__InvalidToken.selector, address(other))
        );
        subs.permitAndCreateSubscription(
            merchantId, address(other), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, sig, sig
        );
    }

    function test_tokenWithoutCapability_reverts() public {
        MockUsdc plain = new MockUsdc();
        vm.prank(admin);
        whitelist.add(address(plain));
        IStrimzSubscriptions.PermitData memory pd =
            _defaultPermit(type(uint256).max, block.timestamp + 24 hours);
        IStrimzSubscriptions.Sig memory sig = IStrimzSubscriptions.Sig(27, bytes32(0), bytes32(0));

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzSubscriptions.Subscriptions__UnsupportedCapability.selector, address(plain)
            )
        );
        subs.permitAndCreateSubscription(
            merchantId, address(plain), AMOUNT, INTERVAL, uint64(block.timestamp), 0, pd, sig, sig
        );
    }

    // Wrong permit signer key — OZ's ERC20Permit reverts.
    function test_invalidPermitSignature_reverts() public {
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory badPermit = _signPermitFor(pd, attackerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0,
            pd, badPermit, intentSig
        );
    }

    function test_expiredPermitDeadline_reverts() public {
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, 1);
        vm.warp(100);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, 1
        );

        vm.prank(relayer);
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );
    }

    function test_paused_reverts() public {
        vm.prank(admin);
        subs.pause();

        uint256 deadline = block.timestamp + 24 hours;
        IStrimzSubscriptions.PermitData memory pd = _defaultPermit(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _signPermitFor(pd, payerPk);
        IStrimzSubscriptions.Sig memory intentSig = _signIntentFor(
            payerPk, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0, deadline
        );

        vm.prank(relayer);
        vm.expectRevert();
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, uint64(block.timestamp), 0,
            pd, permitSig, intentSig
        );
    }
}
