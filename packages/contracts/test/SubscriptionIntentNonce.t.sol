// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract SubscriptionIntentNonceTest is StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;
    address internal attacker;
    address internal relayer;

    uint16 internal constant FEE_BPS = 100;
    uint256 internal constant AMOUNT = 50_000_000;
    uint32 internal constant INTERVAL = 1 hours;
    bytes32 internal constant NONCE = keccak256("intent-1");
    bytes32 internal constant OTHER_NONCE = keccak256("intent-2");

    function setUp() public {
        attacker = makeAddr("attacker");
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

    function test_subscriptionIntentCannotBeReplayedWithLaterPermit() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, _permitSig(pd), intentSig
        );

        IStrimzSubscriptions.Sig memory laterPermitSig = _permitSig(pd);

        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__IntentAlreadyUsed.selector, NONCE));
        vm.prank(attacker);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, laterPermitSig, intentSig
        );
    }

    function test_frontRunPermitDoesNotBlockSubscriptionEnrolment() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _permitSig(pd);
        IStrimzSubscriptions.Sig memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        vm.prank(attacker);
        usdc.permit(payer, address(subs), pd.value, deadline, permitSig.v, permitSig.r, permitSig.s);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );

        assertEq(subs.getSubscription(subId).payer, payer, "enrolment survives a front-run permit");
    }

    function test_reusedNonceRevertsWhenAllowanceAlreadyCoversValue() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _permitSig(pd);
        IStrimzSubscriptions.Sig memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
        assertEq(usdc.allowance(payer, address(subs)), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(IStrimzSubscriptions.Subscriptions__IntentAlreadyUsed.selector, NONCE));
        vm.prank(attacker);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
    }

    function test_differentNonceCreatesSecondSubscription() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);

        vm.prank(relayer);
        uint256 first = subs.permitAndCreateSubscription(
            merchantId,
            address(usdc),
            AMOUNT,
            INTERVAL,
            startAt,
            0,
            NONCE,
            pd,
            _permitSig(pd),
            _intentSig(payerPk, startAt, deadline, NONCE)
        );

        vm.prank(relayer);
        uint256 second = subs.permitAndCreateSubscription(
            merchantId,
            address(usdc),
            AMOUNT,
            INTERVAL,
            startAt,
            0,
            OTHER_NONCE,
            pd,
            _permitSig(pd),
            _intentSig(payerPk, startAt, deadline, OTHER_NONCE)
        );

        assertTrue(first != second, "distinct subscriptions");
        assertEq(subs.getSubscription(second).payer, payer);
        assertEq(usdc.nonces(payer), 2, "both permits consumed");
    }

    function test_nonceIsScopedToPayer() public {
        (address otherPayer, uint256 otherPk) = makeAddrAndKey("otherPayer");
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);

        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId,
            address(usdc),
            AMOUNT,
            INTERVAL,
            startAt,
            0,
            NONCE,
            pd,
            _permitSig(pd),
            _intentSig(payerPk, startAt, deadline, NONCE)
        );

        IStrimzSubscriptions.PermitData memory otherPd =
            IStrimzSubscriptions.PermitData({ owner: otherPayer, value: type(uint256).max, deadline: deadline });
        (uint8 pv, bytes32 pr, bytes32 ps) =
            _signPermit(usdc, otherPk, otherPayer, address(subs), otherPd.value, deadline);

        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId,
            address(usdc),
            AMOUNT,
            INTERVAL,
            startAt,
            0,
            NONCE,
            otherPd,
            IStrimzSubscriptions.Sig(pv, pr, ps),
            _intentSig(otherPk, startAt, deadline, NONCE)
        );

        assertEq(subs.getSubscription(subId).payer, otherPayer);
    }

    function test_frontRunWithInsufficientAllowancePropagatesTokenRevert() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory permitSig = _permitSig(pd);
        IStrimzSubscriptions.Sig memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        vm.prank(attacker);
        usdc.permit(payer, address(subs), pd.value, deadline, permitSig.v, permitSig.r, permitSig.s);
        vm.prank(payer);
        usdc.approve(address(subs), AMOUNT);

        bytes memory tokenRevert = _tokenPermitRevert(pd, permitSig);
        assertEq(
            tokenRevert,
            abi.encodeWithSelector(ERC20Permit.ERC2612InvalidSigner.selector, _permitSigner(pd, permitSig), payer),
            "token rejects the spent permit"
        );

        vm.expectRevert(tokenRevert);
        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );

        vm.prank(payer);
        usdc.approve(address(subs), type(uint256).max);
        vm.prank(relayer);
        uint256 subId = subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, permitSig, intentSig
        );
        assertEq(subs.getSubscription(subId).payer, payer, "a reverted enrolment leaves the nonce unused");
    }

    function test_failedPermitWithoutAllowancePropagatesTokenRevert() public {
        uint256 deadline = block.timestamp + 24 hours;
        uint64 startAt = uint64(block.timestamp);
        IStrimzSubscriptions.PermitData memory pd = _permitData(type(uint256).max, deadline);
        IStrimzSubscriptions.Sig memory badPermitSig =
            IStrimzSubscriptions.Sig(27, bytes32(uint256(1)), bytes32(uint256(2)));
        IStrimzSubscriptions.Sig memory intentSig = _intentSig(payerPk, startAt, deadline, NONCE);

        bytes memory tokenRevert = _tokenPermitRevert(pd, badPermitSig);
        assertGt(tokenRevert.length, 0, "token reverts with a reason");

        vm.expectRevert(tokenRevert);
        vm.prank(relayer);
        subs.permitAndCreateSubscription(
            merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, NONCE, pd, badPermitSig, intentSig
        );
    }

    function test_createSubscriptionUnaffectedByIntentNonces() public {
        vm.startPrank(payer);
        usdc.approve(address(subs), type(uint256).max);
        uint256 first = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
        uint256 second = subs.createSubscription(merchantId, address(usdc), AMOUNT, INTERVAL, 0, 0);
        vm.stopPrank();

        assertTrue(first != second, "identical direct enrolments are not deduplicated");
        assertEq(subs.getSubscription(first).payer, payer);
        assertEq(subs.getSubscription(second).payer, payer);
    }

    function test_intentDigestMatchesTypehash() public view {
        bytes32 typehash = keccak256(
            "SubscriptionIntent(uint256 merchantId,address token,uint256 amount,uint32 interval,uint64 startAt,uint64 endAt,uint256 permitDeadline,bytes32 nonce)"
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("StrimzSubscriptions"),
                keccak256("1"),
                block.chainid,
                address(subs)
            )
        );
        uint256 deadline = 1_000;
        bytes32 structHash = keccak256(
            abi.encode(typehash, merchantId, address(usdc), AMOUNT, INTERVAL, uint64(5), uint64(0), deadline, NONCE)
        );
        bytes32 expected = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        assertEq(
            subs.subscriptionIntentDigest(merchantId, address(usdc), AMOUNT, INTERVAL, 5, 0, deadline, NONCE), expected
        );
    }

    function _permitData(uint256 value, uint256 deadline)
        internal
        view
        returns (IStrimzSubscriptions.PermitData memory)
    {
        return IStrimzSubscriptions.PermitData({ owner: payer, value: value, deadline: deadline });
    }

    function _tokenPermitRevert(IStrimzSubscriptions.PermitData memory pd, IStrimzSubscriptions.Sig memory sig)
        internal
        returns (bytes memory)
    {
        (bool ok, bytes memory ret) = address(usdc).call(
            abi.encodeCall(usdc.permit, (pd.owner, address(subs), pd.value, pd.deadline, sig.v, sig.r, sig.s))
        );
        assertFalse(ok, "token permit must fail");
        return ret;
    }

    function _permitSigner(IStrimzSubscriptions.PermitData memory pd, IStrimzSubscriptions.Sig memory sig)
        internal
        view
        returns (address)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                pd.owner,
                address(subs),
                pd.value,
                usdc.nonces(pd.owner),
                pd.deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        return ecrecover(digest, sig.v, sig.r, sig.s);
    }

    function _permitSig(IStrimzSubscriptions.PermitData memory pd)
        internal
        view
        returns (IStrimzSubscriptions.Sig memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(usdc, payerPk, pd.owner, address(subs), pd.value, pd.deadline);
        return IStrimzSubscriptions.Sig(v, r, s);
    }

    function _intentSig(uint256 signerPk, uint64 startAt, uint256 deadline, bytes32 nonce)
        internal
        view
        returns (IStrimzSubscriptions.Sig memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = _signSubscriptionIntent(
            subs, signerPk, merchantId, address(usdc), AMOUNT, INTERVAL, startAt, 0, deadline, nonce
        );
        return IStrimzSubscriptions.Sig(v, r, s);
    }
}
