// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Upgrades, Options } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { StrimzRegistry } from "../src/core/StrimzRegistry.sol";
import { StrimzAgentRegistry } from "../src/agent/StrimzAgentRegistry.sol";
import { IStrimzRegistry } from "../src/interfaces/IStrimzRegistry.sol";
import { IStrimzAgentRegistry } from "../src/interfaces/IStrimzAgentRegistry.sol";
import { StrimzRegistryV1 } from "./upgrades/StrimzRegistryV1.sol";
import { StrimzAgentRegistryV1 } from "./upgrades/StrimzAgentRegistryV1.sol";

/// @dev V2 of TokenWhitelist with one new function. Demonstrates that an
///      upgrade adds behaviour while preserving every prior storage value.
///      The oz-upgrades-from annotation tells the OpenZeppelin Foundry
///      Upgrades validator to compare this contract's storage layout against
///      TokenWhitelist and reject the upgrade if a collision is introduced.
/// @custom:oz-upgrades-from TokenWhitelist
contract TokenWhitelistV2 is TokenWhitelist {
    function version() external pure returns (string memory) {
        return "v2";
    }
}

/// @dev Storage is preserved across upgrades. This test goes through the
///      OpenZeppelin Upgrades plugin so the storage-layout safety check
///      runs as part of the upgrade — not just as a runtime assertion.
contract UpgradeabilityTest is StrimzTestBase {
    address internal whitelistProxy;

    function setUp() public {
        _setUpTokens();
        // Use the validated path here too: deploy via the Upgrades plugin.
        whitelistProxy =
            Upgrades.deployUUPSProxy("TokenWhitelist.sol", abi.encodeCall(TokenWhitelist.initialize, (admin)));
    }

    function test_storageSurvivesUpgrade() public {
        // Pre-upgrade: write some state.
        vm.prank(admin);
        TokenWhitelist(whitelistProxy).add(address(usdc));
        assertTrue(TokenWhitelist(whitelistProxy).isWhitelisted(address(usdc)), "pre-upgrade write");

        // Upgrade with storage-safety validation. `startPrank` + `stopPrank`
        // so every call the OZ helper makes (impl deploy, upgrade tx) runs
        // as the admin (which holds UPGRADER_ROLE).
        vm.startPrank(admin);
        Upgrades.upgradeProxy(whitelistProxy, "Upgradeability.t.sol:TokenWhitelistV2", "");
        vm.stopPrank();

        // Old data still readable; new function works.
        assertTrue(
            TokenWhitelist(whitelistProxy).isWhitelisted(address(usdc)),
            "post-upgrade read of pre-upgrade write"
        );
        assertEq(TokenWhitelistV2(whitelistProxy).version(), "v2", "new function works");
    }

    function test_unauthorisedUpgradeReverts() public {
        // Pre-deploy a V2 impl (admin pays for it) so the test isolates
        // the access-control check on the upgrade call itself, not the
        // contract deploy.
        TokenWhitelistV2 implV2 = new TokenWhitelistV2();

        // _authorizeUpgrade is gated by UPGRADER_ROLE — calling
        // upgradeToAndCall as a non-admin must revert.
        vm.prank(payer);
        vm.expectRevert();
        UUPSUpgradeable(whitelistProxy).upgradeToAndCall(address(implV2), "");
    }
}

contract PermissionGapsUpgradeTest is StrimzTestBase {
    function _v1Options() internal pure returns (Options memory opts) {
        opts.unsafeAllow = "constructor";
    }

    function _upgradeOptions(string memory referenceContract) internal pure returns (Options memory opts) {
        opts.referenceContract = referenceContract;
    }

    function test_registryUpgradesInPlaceAndKeepsStorage() public {
        address proxy = Upgrades.deployUUPSProxy(
            "StrimzRegistryV1.sol:StrimzRegistryV1", abi.encodeCall(StrimzRegistryV1.initialize, (admin)), _v1Options()
        );
        StrimzRegistryV1 v1 = StrimzRegistryV1(proxy);
        address nominee = makeAddr("nominee");
        address pendingPayout = makeAddr("pendingPayout");
        address childOwner = makeAddr("childOwner");
        address childPayout = makeAddr("childPayout");

        vm.startPrank(admin);
        uint256 parentId = v1.registerMerchant(merchant, merchantPayout, 100, 0);
        uint256 childId = v1.registerMerchant(childOwner, childPayout, 250, parentId);
        v1.setActive(childId, false);
        vm.stopPrank();
        vm.startPrank(merchant);
        v1.setPayoutAddress(parentId, pendingPayout);
        v1.transferMerchantOwnership(parentId, nominee);
        vm.stopPrank();
        uint64 commitAt = uint64(block.timestamp) + 24 hours;

        vm.startPrank(admin);
        Upgrades.upgradeProxy(
            proxy, "StrimzRegistry.sol:StrimzRegistry", "", _upgradeOptions("StrimzRegistryV1.sol:StrimzRegistryV1")
        );
        vm.stopPrank();

        StrimzRegistry registry = StrimzRegistry(proxy);
        assertEq(registry.nextMerchantId(), 3);
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.UPGRADER_ROLE(), admin));
        assertTrue(registry.hasRole(registry.MERCHANT_REGISTRAR_ROLE(), admin));

        IStrimzRegistry.Merchant memory parent = registry.getMerchant(parentId);
        assertEq(parent.owner, merchant);
        assertEq(parent.feeBps, 100);
        assertTrue(parent.active);
        assertEq(parent.payoutAddress, merchantPayout);
        assertEq(parent.parentMerchantId, 0);
        assertEq(parent.pendingOwner, nominee);
        assertEq(parent.pendingPayoutAddress, pendingPayout);
        assertEq(parent.payoutChangeCommitAt, commitAt);
        assertEq(parent.maxFeeBps, 100);

        IStrimzRegistry.Merchant memory child = registry.getMerchant(childId);
        assertEq(child.owner, childOwner);
        assertEq(child.feeBps, 250);
        assertFalse(child.active);
        assertEq(child.payoutAddress, childPayout);
        assertEq(child.parentMerchantId, parentId);
        assertEq(child.pendingOwner, address(0));
        assertEq(child.pendingPayoutAddress, address(0));
        assertEq(child.payoutChangeCommitAt, 0);
        assertEq(child.maxFeeBps, 250);

        assertEq(registry.pendingOwnerAcceptableAt(parentId), 0);
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY() + 1);
        vm.expectRevert(IStrimzRegistry.Registry__OwnershipTransferNotDue.selector);
        vm.prank(nominee);
        registry.acceptMerchantOwnership(parentId);

        vm.prank(merchant);
        registry.transferMerchantOwnership(parentId, nominee);
        vm.warp(block.timestamp + registry.PAYOUT_CHANGE_DELAY());
        vm.prank(nominee);
        registry.acceptMerchantOwnership(parentId);

        IStrimzRegistry.Merchant memory accepted = registry.getMerchant(parentId);
        assertEq(accepted.owner, nominee);
        assertEq(accepted.pendingPayoutAddress, address(0));
        assertEq(accepted.payoutChangeCommitAt, 0);
        assertEq(accepted.payoutAddress, merchantPayout);
    }

    function test_agentRegistryUpgradesInPlaceAndKeepsStorage() public {
        address proxy = Upgrades.deployUUPSProxy(
            "StrimzAgentRegistryV1.sol:StrimzAgentRegistryV1",
            abi.encodeCall(StrimzAgentRegistryV1.initialize, (admin)),
            _v1Options()
        );
        StrimzAgentRegistryV1 v1 = StrimzAgentRegistryV1(proxy);
        address live = makeAddr("liveAgent");
        address stopped = makeAddr("stoppedAgent");
        uint64 registeredAt = uint64(block.timestamp);

        vm.prank(live);
        v1.registerAgent(live, bytes32(uint256(1)), "live", "1.0.0");
        vm.prank(stopped);
        v1.registerAgent(stopped, bytes32(uint256(2)), "stopped", "2.0.0");
        vm.startPrank(admin);
        v1.adjustReputation(live, -7);
        v1.deactivate(stopped);
        vm.stopPrank();

        vm.startPrank(admin);
        Upgrades.upgradeProxy(
            proxy,
            "StrimzAgentRegistry.sol:StrimzAgentRegistry",
            "",
            _upgradeOptions("StrimzAgentRegistryV1.sol:StrimzAgentRegistryV1")
        );
        vm.stopPrank();

        StrimzAgentRegistry agents = StrimzAgentRegistry(proxy);
        assertTrue(agents.hasRole(agents.AGENT_ADMIN_ROLE(), admin));
        assertTrue(agents.hasRole(agents.UPGRADER_ROLE(), admin));

        IStrimzAgentRegistry.Agent memory a = agents.getAgent(live);
        assertEq(a.controller, live);
        assertEq(a.credentialDigest, bytes32(uint256(1)));
        assertEq(a.name, "live");
        assertEq(a.version, "1.0.0");
        assertEq(a.reputationScore, -7);
        assertEq(a.registeredAt, registeredAt);
        assertTrue(a.active);
        assertTrue(agents.isActive(live));
        assertFalse(agents.isSuspended(live));

        IStrimzAgentRegistry.Agent memory b = agents.getAgent(stopped);
        assertEq(b.controller, stopped);
        assertEq(b.credentialDigest, bytes32(uint256(2)));
        assertEq(b.name, "stopped");
        assertEq(b.version, "2.0.0");
        assertFalse(b.active);
        assertFalse(agents.isActive(stopped));
        assertFalse(agents.isSuspended(stopped));

        vm.prank(admin);
        agents.deactivate(live);
        vm.expectRevert(abi.encodeWithSelector(IStrimzAgentRegistry.AgentRegistry__Suspended.selector, live));
        vm.prank(live);
        agents.activate(live);
    }
}
