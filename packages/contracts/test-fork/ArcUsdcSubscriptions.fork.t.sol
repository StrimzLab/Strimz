// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ArcForkBase } from "./ArcForkBase.sol";
import { MockErc1271Wallet } from "../test/Helpers.t.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAccessControl } from "../src/access/StrimzAccessControl.sol";
import { IStrimzSubscriptions } from "../src/interfaces/IStrimzSubscriptions.sol";

contract ArcUsdcSubscriptionsForkTest is ArcForkBase {
    uint16 internal constant FEE_BPS = 100;
    uint256 internal constant AMOUNT = 10_000_000;

    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzSubscriptions internal subs;
    uint256 internal merchantId;
    uint256 internal blockedMerchantId;

    function setUp() public {
        _forkArcTestnet();

        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        subs = _deploySubscriptions(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(ARC_USDC));
        feeCollector.grantRole(StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(subs));
        merchantId = registry.registerMerchant(merchant, merchantPayout, FEE_BPS, FEE_BPS, 0);
        blockedMerchantId = registry.registerMerchant(vendor, ARC_TESTNET_BLOCKLISTED, FEE_BPS, FEE_BPS, 0);
        vm.stopPrank();

        vm.deal(payer, 100 ether);
        vm.prank(payer);
        ARC_USDC.approve(address(subs), type(uint256).max);
    }

    function test_blocklistedPayoutFailsOnlyItsOwnRowInABatch() public {
        vm.startPrank(payer);
        uint256 blocked = subs.createSubscription(blockedMerchantId, address(ARC_USDC), AMOUNT, 1 hours, 0, 0);
        uint256 good = subs.createSubscription(merchantId, address(ARC_USDC), AMOUNT, 1 hours, 0, 0);
        vm.stopPrank();

        uint256[] memory ids = new uint256[](2);
        bytes32[] memory attempts = new bytes32[](2);
        ids[0] = blocked;
        ids[1] = good;
        attempts[0] = keccak256("arc-fork-blocked-row");
        attempts[1] = keccak256("arc-fork-good-row");

        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);

        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.TransferFailed), "blocked row");
        assertEq(uint256(outcomes[1]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged), "good row");
        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        assertEq(ARC_USDC.balanceOf(merchantPayout), AMOUNT - fee, "good merchant paid");
        assertEq(ARC_USDC.balanceOf(payer), 100_000_000 - AMOUNT, "payer charged once");
    }

    function test_contractWalletSubscribesWithPermitAndIsCharged() public {
        uint8 permitCap = whitelist.CAP_PERMIT_2612();
        vm.prank(admin);
        whitelist.setCapabilities(address(ARC_USDC), permitCap);
        (address owner, uint256 ownerPk) = makeAddrAndKey("walletOwner");
        MockErc1271Wallet wallet = new MockErc1271Wallet(owner);
        vm.deal(address(wallet), 100 ether);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("arc-fork-wallet-sub");
        IStrimzSubscriptions.PermitData memory pd =
            IStrimzSubscriptions.PermitData({ owner: address(wallet), value: type(uint256).max, deadline: deadline });
        bytes memory permitSig = _signArcPermit(ownerPk, address(wallet), address(subs), pd.value, deadline);
        (uint8 v, bytes32 r, bytes32 s) = _signSubscriptionIntent(
            subs, ownerPk, merchantId, address(ARC_USDC), AMOUNT, 1 hours, 0, 0, deadline, pd.value, nonce
        );

        uint256 id = subs.permitAndCreateSubscription(
            merchantId, address(ARC_USDC), AMOUNT, 1 hours, 0, 0, nonce, pd, permitSig, abi.encodePacked(r, s, v)
        );
        assertEq(ARC_USDC.allowance(address(wallet), address(subs)), type(uint256).max, "permit set");

        uint256[] memory ids = new uint256[](1);
        bytes32[] memory attempts = new bytes32[](1);
        ids[0] = id;
        attempts[0] = keccak256("arc-fork-wallet-charge");
        vm.prank(admin);
        IStrimzSubscriptions.ChargeOutcome[] memory outcomes = subs.batchCharge(ids, attempts);

        assertEq(uint256(outcomes[0]), uint256(IStrimzSubscriptions.ChargeOutcome.Charged), "charged");
        assertEq(ARC_USDC.balanceOf(address(wallet)), 100_000_000 - AMOUNT, "wallet debited");
    }
}
