// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { StrimzRegistryV1 } from "./upgrades/StrimzRegistryV1.sol";
import { ProxyDeploy } from "../script/utils/ProxyDeploy.sol";
import { AdminHandoff } from "../script/utils/AdminHandoff.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { FeeCollector } from "../src/fees/FeeCollector.sol";
import { StrimzPayments } from "../src/core/StrimzPayments.sol";
import { StrimzSubscriptions } from "../src/core/StrimzSubscriptions.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";

contract MockSafe {
    uint256 public getThreshold;

    constructor(uint256 threshold) {
        getThreshold = threshold;
    }
}

contract HandoffRunner {
    function run(AdminHandoff.Contracts memory c, AdminHandoff.Holders memory h, uint256 minDelay)
        external
        returns (TimelockController)
    {
        return AdminHandoff.run(c, h, minDelay);
    }
}

contract AdminHandoffTest is StrimzTestBase {
    uint256 internal constant MIN_DELAY = 48 hours;
    uint256 internal constant AMOUNT = 100_000_000;

    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 internal constant ADMIN_ROLE = keccak256("STRIMZ_ADMIN_ROLE");
    bytes32 internal constant UPGRADER_ROLE = keccak256("STRIMZ_UPGRADER_ROLE");
    bytes32 internal constant CHARGER_ROLE = keccak256("STRIMZ_CHARGER_ROLE");
    bytes32 internal constant TOKEN_MANAGER_ROLE = keccak256("STRIMZ_TOKEN_MANAGER_ROLE");
    bytes32 internal constant MERCHANT_REGISTRAR_ROLE = keccak256("STRIMZ_MERCHANT_REGISTRAR_ROLE");
    bytes32 internal constant FEE_ACCRUER_ROLE = keccak256("STRIMZ_FEE_ACCRUER_ROLE");
    bytes32 internal constant TREASURY_ROLE = keccak256("STRIMZ_TREASURY_ROLE");
    bytes32 internal constant AGENT_ADMIN_ROLE = keccak256("STRIMZ_AGENT_ADMIN_ROLE");
    bytes32 internal constant PAUSER_ROLE = keccak256("STRIMZ_PAUSER_ROLE");
    bytes32 internal constant DISPUTE_RESOLVER_ROLE = keccak256("STRIMZ_DISPUTE_RESOLVER_ROLE");

    HandoffRunner internal runner;
    MockSafe internal safe;
    address internal deployer;
    address internal guardian;
    address internal relayer;
    address internal scheduler;

    StrimzRegistry internal registry;
    TokenWhitelist internal whitelist;
    FeeCollector internal feeCollector;
    StrimzPayments internal payments;
    StrimzSubscriptions internal subs;
    StrimzAgentRegistry internal agents;
    StrimzAgentEscrow internal escrow;
    TimelockController internal timelock;

    function setUp() public {
        _setUpTokens();
        runner = new HandoffRunner();
        safe = new MockSafe(2);
        deployer = address(runner);
        guardian = makeAddr("guardian");
        relayer = makeAddr("relayer");
        scheduler = makeAddr("scheduler");

        registry = _deployRegistry(deployer);
        whitelist = _deployTokenWhitelist(deployer);
        feeCollector = _deployFeeCollector(deployer);
        payments = _deployPayments(deployer, registry, feeCollector, whitelist);
        subs = _deploySubscriptions(deployer, registry, feeCollector, whitelist);
        agents = _deployAgentRegistry(deployer);
        escrow = _deployAgentEscrow(deployer, whitelist);

        vm.startPrank(deployer);
        feeCollector.grantRole(FEE_ACCRUER_ROLE, address(payments));
        feeCollector.grantRole(FEE_ACCRUER_ROLE, address(subs));
        whitelist.add(address(usdc));
        vm.stopPrank();
    }

    function _contracts() internal view returns (AdminHandoff.Contracts memory) {
        return AdminHandoff.Contracts({
            registry: address(registry),
            tokenWhitelist: address(whitelist),
            feeCollector: address(feeCollector),
            payments: address(payments),
            subscriptions: address(subs),
            agentRegistry: address(agents),
            agentEscrow: address(escrow)
        });
    }

    function _holders() internal view returns (AdminHandoff.Holders memory) {
        return AdminHandoff.Holders({
            safe: address(safe),
            guardian: guardian,
            relayer: relayer,
            scheduler: scheduler,
            deployer: deployer
        });
    }

    function _handoff() internal {
        timelock = runner.run(_contracts(), _holders(), MIN_DELAY);
    }

    function _all() internal view returns (address[7] memory) {
        return [
            address(registry),
            address(whitelist),
            address(feeCollector),
            address(payments),
            address(subs),
            address(agents),
            address(escrow)
        ];
    }

    function _roles() internal pure returns (bytes32[11] memory) {
        return [
            DEFAULT_ADMIN_ROLE,
            ADMIN_ROLE,
            UPGRADER_ROLE,
            CHARGER_ROLE,
            TOKEN_MANAGER_ROLE,
            MERCHANT_REGISTRAR_ROLE,
            FEE_ACCRUER_ROLE,
            TREASURY_ROLE,
            AGENT_ADMIN_ROLE,
            PAUSER_ROLE,
            DISPUTE_RESOLVER_ROLE
        ];
    }

    function _has(address target, bytes32 role, address account) internal view returns (bool) {
        return StrimzRegistry(target).hasRole(role, account);
    }

    function test_deployerHoldsNoRoleAfterHandoff() public {
        _handoff();
        address[7] memory targets = _all();
        bytes32[11] memory roles = _roles();
        for (uint256 i; i < targets.length; ++i) {
            for (uint256 j; j < roles.length; ++j) {
                assertFalse(_has(targets[i], roles[j], deployer), "deployer keeps a role");
            }
        }
    }

    function test_schedulerManagesFeesAfterHandoff() public {
        _handoff();
        bytes32 feeManagerRole = keccak256("STRIMZ_FEE_MANAGER_ROLE");
        assertTrue(_has(address(registry), feeManagerRole, scheduler), "scheduler fee manager");
        assertFalse(_has(address(registry), feeManagerRole, relayer), "relayer fee manager");
        assertFalse(_has(address(registry), feeManagerRole, address(safe)), "safe fee manager");
        assertEq(
            registry.getRoleAdmin(feeManagerRole),
            keccak256("STRIMZ_ADMIN_ROLE"),
            "fee manager administered by ADMIN_ROLE"
        );
    }

    function test_roleTableAfterHandoff() public {
        _handoff();
        address t = address(timelock);
        address s = address(safe);
        address[7] memory targets = _all();
        for (uint256 i; i < targets.length; ++i) {
            assertTrue(_has(targets[i], DEFAULT_ADMIN_ROLE, t), "timelock default admin");
            assertFalse(_has(targets[i], DEFAULT_ADMIN_ROLE, s), "safe default admin");
        }

        address[5] memory upgradeable =
            [address(registry), address(whitelist), address(feeCollector), address(agents), address(escrow)];
        for (uint256 i; i < upgradeable.length; ++i) {
            assertTrue(_has(upgradeable[i], UPGRADER_ROLE, t), "timelock upgrader");
            assertFalse(_has(upgradeable[i], UPGRADER_ROLE, s), "safe upgrader");
        }

        assertTrue(_has(address(whitelist), TOKEN_MANAGER_ROLE, t), "timelock token manager");
        assertFalse(_has(address(whitelist), TOKEN_MANAGER_ROLE, s), "safe token manager");

        address[4] memory administered = [address(registry), address(payments), address(subs), address(escrow)];
        for (uint256 i; i < administered.length; ++i) {
            assertTrue(_has(administered[i], ADMIN_ROLE, s), "safe admin");
            assertTrue(_has(administered[i], ADMIN_ROLE, t), "timelock admin");
        }
        assertFalse(_has(address(whitelist), ADMIN_ROLE, s), "safe admin on whitelist");
        assertFalse(_has(address(feeCollector), ADMIN_ROLE, s), "safe admin on fee collector");
        assertFalse(_has(address(agents), ADMIN_ROLE, s), "safe admin on agent registry");

        address[3] memory pausable = [address(payments), address(subs), address(escrow)];
        for (uint256 i; i < pausable.length; ++i) {
            assertTrue(_has(pausable[i], PAUSER_ROLE, s), "safe pauser");
            assertTrue(_has(pausable[i], PAUSER_ROLE, t), "timelock pauser");
            assertTrue(_has(pausable[i], PAUSER_ROLE, guardian), "guardian pauser");
            assertFalse(_has(pausable[i], ADMIN_ROLE, guardian), "guardian admin");
        }

        assertTrue(_has(address(feeCollector), TREASURY_ROLE, s), "safe treasury");
        assertTrue(_has(address(escrow), DISPUTE_RESOLVER_ROLE, s), "safe dispute resolver");
        assertTrue(_has(address(agents), AGENT_ADMIN_ROLE, s), "safe agent admin");

        assertTrue(_has(address(registry), MERCHANT_REGISTRAR_ROLE, relayer), "relayer registrar");
        assertFalse(_has(address(subs), CHARGER_ROLE, relayer), "relayer charger");
        assertTrue(_has(address(subs), CHARGER_ROLE, scheduler), "scheduler charger");
        assertFalse(_has(address(registry), MERCHANT_REGISTRAR_ROLE, scheduler), "scheduler registrar");

        assertTrue(_has(address(feeCollector), FEE_ACCRUER_ROLE, address(payments)), "payments accrues");
        assertTrue(_has(address(feeCollector), FEE_ACCRUER_ROLE, address(subs)), "subscriptions accrue");

        assertEq(registry.getRoleAdmin(MERCHANT_REGISTRAR_ROLE), ADMIN_ROLE, "registrar administered by admin");
        assertEq(subs.getRoleAdmin(CHARGER_ROLE), ADMIN_ROLE, "charger administered by admin");
    }

    function test_timelockGovernsItself() public {
        _handoff();
        assertEq(timelock.getMinDelay(), MIN_DELAY);
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(safe)), "safe proposes");
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), address(safe)), "safe cancels");
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0)), "anyone executes");
        assertTrue(timelock.hasRole(DEFAULT_ADMIN_ROLE, address(timelock)), "timelock admin of itself");
        assertFalse(timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer), "deployer not timelock admin");
        assertFalse(timelock.hasRole(DEFAULT_ADMIN_ROLE, address(safe)), "safe not timelock admin");
        assertFalse(timelock.hasRole(timelock.PROPOSER_ROLE(), deployer), "deployer not proposer");
    }

    function test_safeActsWithoutDelay() public {
        _handoff();
        vm.prank(relayer);
        uint256 merchantId = registry.registerMerchant(merchant, merchantPayout, 150, 150, 0);
        vm.prank(vendor);
        agents.registerAgent(vendor, bytes32(uint256(1)), "agent", "1.0.0");

        vm.startPrank(address(safe));
        registry.setFeeBps(merchantId, 80);
        registry.setActive(merchantId, false);
        payments.pause();
        payments.unpause();
        subs.pause();
        subs.unpause();
        escrow.pause();
        escrow.unpause();
        agents.adjustReputation(vendor, 1);
        vm.stopPrank();
        assertEq(registry.getMerchant(merchantId).feeBps, 80);
        assertFalse(registry.getMerchant(merchantId).active);

        _fund(address(feeCollector), AMOUNT);
        vm.prank(address(safe));
        feeCollector.withdraw(address(usdc), treasury, AMOUNT);
        assertEq(usdc.balanceOf(treasury), AMOUNT);

        _fund(payer, AMOUNT);
        vm.startPrank(payer);
        usdc.approve(address(escrow), AMOUNT);
        uint256 jobId = escrow.createJob(vendor, assessor, address(usdc), AMOUNT, "job");
        escrow.fundJob(jobId);
        vm.stopPrank();
        vm.prank(vendor);
        escrow.startJob(jobId);
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, "hash");
        vm.prank(payer);
        escrow.dispute(jobId, "quality");
        vm.prank(address(safe));
        escrow.resolveDispute(jobId, AMOUNT, 0);
        assertEq(usdc.balanceOf(vendor), AMOUNT);
    }

    function test_guardianOnlyPauses() public {
        _handoff();
        vm.prank(guardian);
        payments.pause();
        assertTrue(payments.paused());
        vm.expectRevert();
        vm.prank(guardian);
        payments.unpause();
        vm.expectRevert();
        vm.prank(guardian);
        registry.setActive(1, false);
    }

    function test_safeCannotRotateUpgradeOrGrantDirectly() public {
        _handoff();
        address other = makeAddr("other");
        address newImplementation = address(new StrimzRegistry());
        vm.startPrank(address(safe));
        payments.pause();
        vm.expectRevert();
        payments.setRegistry(IStrimzRegistry(other));
        subs.pause();
        vm.expectRevert();
        subs.setRegistry(IStrimzRegistry(other));
        vm.expectRevert();
        whitelist.add(other);
        vm.expectRevert();
        UUPSUpgradeable(address(registry)).upgradeToAndCall(newImplementation, "");
        vm.expectRevert();
        registry.grantRole(ADMIN_ROLE, other);
        vm.expectRevert();
        feeCollector.grantRole(FEE_ACCRUER_ROLE, other);
        vm.stopPrank();
    }

    function test_timelockRotationWaitsForDelay() public {
        _handoff();
        address newRegistry = address(_deployRegistry(address(timelock)));

        address[] memory targets = new address[](3);
        uint256[] memory values = new uint256[](3);
        bytes[] memory payloads = new bytes[](3);
        targets[0] = address(payments);
        targets[1] = address(payments);
        targets[2] = address(payments);
        payloads[0] = abi.encodeWithSignature("pause()");
        payloads[1] = abi.encodeCall(StrimzPayments.setRegistry, (IStrimzRegistry(newRegistry)));
        payloads[2] = abi.encodeWithSignature("unpause()");
        bytes32 salt = keccak256("rotate-registry");

        vm.prank(address(safe));
        timelock.scheduleBatch(targets, values, payloads, bytes32(0), salt, MIN_DELAY);

        address anyone = makeAddr("anyone");
        vm.expectRevert();
        vm.prank(anyone);
        timelock.executeBatch(targets, values, payloads, bytes32(0), salt);

        vm.warp(block.timestamp + MIN_DELAY);
        vm.prank(anyone);
        timelock.executeBatch(targets, values, payloads, bytes32(0), salt);

        assertEq(address(payments.registry()), newRegistry);
        assertFalse(payments.paused());
    }

    function test_safeRotatesServiceKeysWithoutDelay() public {
        _handoff();
        address newScheduler = makeAddr("newScheduler");
        address newRelayer = makeAddr("newRelayer");
        vm.startPrank(address(safe));
        subs.revokeRole(CHARGER_ROLE, scheduler);
        subs.grantRole(CHARGER_ROLE, newScheduler);
        registry.revokeRole(MERCHANT_REGISTRAR_ROLE, relayer);
        registry.grantRole(MERCHANT_REGISTRAR_ROLE, newRelayer);
        vm.stopPrank();
        assertFalse(subs.hasRole(CHARGER_ROLE, scheduler));
        assertTrue(subs.hasRole(CHARGER_ROLE, newScheduler));
        assertFalse(registry.hasRole(MERCHANT_REGISTRAR_ROLE, relayer));
        assertTrue(registry.hasRole(MERCHANT_REGISTRAR_ROLE, newRelayer));
    }

    function test_handoffWithoutGuardian() public {
        AdminHandoff.Holders memory h = _holders();
        h.guardian = address(0);
        timelock = runner.run(_contracts(), h, MIN_DELAY);
        assertFalse(payments.hasRole(PAUSER_ROLE, address(0)));
        assertFalse(payments.hasRole(PAUSER_ROLE, guardian));
        assertTrue(payments.hasRole(PAUSER_ROLE, address(safe)));
    }

    function test_refusesSafeBelowThresholdTwo() public {
        MockSafe single = new MockSafe(1);
        AdminHandoff.Holders memory h = _holders();
        h.safe = address(single);
        vm.expectRevert(abi.encodeWithSelector(AdminHandoff.AdminHandoff__SafeThresholdTooLow.selector, 1));
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesSafeWithoutCode() public {
        AdminHandoff.Holders memory h = _holders();
        h.safe = makeAddr("eoaSafe");
        vm.expectRevert(abi.encodeWithSelector(AdminHandoff.AdminHandoff__SafeHasNoCode.selector, h.safe));
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesRelayerEqualToScheduler() public {
        AdminHandoff.Holders memory h = _holders();
        h.scheduler = relayer;
        vm.expectRevert(AdminHandoff.AdminHandoff__HoldersNotDistinct.selector);
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesGuardianEqualToSafe() public {
        AdminHandoff.Holders memory h = _holders();
        h.guardian = address(safe);
        vm.expectRevert(AdminHandoff.AdminHandoff__HoldersNotDistinct.selector);
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesDeployerAsServiceKey() public {
        AdminHandoff.Holders memory h = _holders();
        h.relayer = deployer;
        vm.expectRevert(AdminHandoff.AdminHandoff__HoldersNotDistinct.selector);
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesMissingRelayer() public {
        AdminHandoff.Holders memory h = _holders();
        h.relayer = address(0);
        vm.expectRevert(AdminHandoff.AdminHandoff__ZeroAddress.selector);
        runner.run(_contracts(), h, MIN_DELAY);
    }

    function test_refusesZeroDelay() public {
        vm.expectRevert(AdminHandoff.AdminHandoff__ZeroDelay.selector);
        runner.run(_contracts(), _holders(), 0);
    }

    /// The registry deployed before #130 never made ADMIN_ROLE the registrar's admin.
    function test_refusesRegistryWithoutRoleAdmins() public {
        address old = ProxyDeploy.deploy(
            address(new StrimzRegistryV1()), abi.encodeCall(StrimzRegistryV1.initialize, (deployer))
        );
        registry = StrimzRegistry(old);
        vm.expectRevert(
            abi.encodeWithSelector(AdminHandoff.AdminHandoff__ServiceRoleAdminNotSet.selector, address(registry))
        );
        runner.run(_contracts(), _holders(), MIN_DELAY);
    }

    function test_refusesSecondRun() public {
        _handoff();
        vm.expectRevert(
            abi.encodeWithSelector(AdminHandoff.AdminHandoff__DeployerNotAdmin.selector, address(registry))
        );
        runner.run(_contracts(), _holders(), MIN_DELAY);
    }
}
