// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, StdInvariant } from "forge-std/Test.sol";
import { StrimzTestBase } from "../Helpers.t.sol";
import { StrimzRegistry } from "../../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../../src/core/StrimzPayments.sol";
import { StrimzAccessControl } from "../../src/access/StrimzAccessControl.sol";
import { MockUsdc } from "../Helpers.t.sol";

/// @dev A bounded-action handler that drives random calls into Payments
///      under realistic preconditions (whitelisted token, registered
///      merchant, funded payer, valid approval). Without this handler the
///      raw fuzzer cannot satisfy the call's preconditions and reports
///      "no contracts to fuzz".
contract PaymentsHandler is Test {
    StrimzPayments public immutable payments;
    MockUsdc public immutable usdc;
    uint256 public immutable merchantId;

    address[3] internal payers;

    constructor(StrimzPayments _payments, MockUsdc _usdc, uint256 _merchantId) {
        payments = _payments;
        usdc = _usdc;
        merchantId = _merchantId;

        payers[0] = makeAddr("invariant.payer.0");
        payers[1] = makeAddr("invariant.payer.1");
        payers[2] = makeAddr("invariant.payer.2");
        for (uint256 i = 0; i < payers.length; i++) {
            usdc.mint(payers[i], 1_000_000_000_000);
        }
    }

    function pay(uint8 payerIdx, uint128 amountIn) external {
        address payer = payers[payerIdx % payers.length];
        uint256 capped = (uint256(amountIn) % 100_000_000_000) + 1;

        vm.prank(payer);
        usdc.approve(address(payments), capped);

        vm.prank(payer);
        try payments.pay(merchantId, address(usdc), capped, bytes32(0)) { } catch { }
    }
}

/// @dev Invariant: the FeeCollector's ERC20 balance never exceeds the
///      total fee amount it has accrued. Proves no value leaks out unless
///      explicitly withdrawn by TREASURY_ROLE.
contract PaymentsInvariantsTest is StdInvariant, StrimzTestBase {
    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    PaymentsHandler internal handler;

    function setUp() public {
        _setUpTokens();
        registry = _deployRegistry(admin);
        whitelist = _deployTokenWhitelist(admin);
        feeCollector = _deployFeeCollector(admin);
        payments = _deployPayments(admin, registry, feeCollector, whitelist);

        vm.startPrank(admin);
        whitelist.add(address(usdc));
        feeCollector.grantRole(
            StrimzAccessControl(address(feeCollector)).FEE_ACCRUER_ROLE(), address(payments)
        );
        uint256 mid = registry.registerMerchant(merchant, merchantPayout, 200);
        vm.stopPrank();

        handler = new PaymentsHandler(payments, usdc, mid);
        targetContract(address(handler));
    }

    function invariant_feeCollectorBalanceBoundedByAccrued() public view {
        assertLe(usdc.balanceOf(address(feeCollector)), feeCollector.totalAccrued(address(usdc)));
    }
}
