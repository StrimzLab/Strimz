// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";

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
