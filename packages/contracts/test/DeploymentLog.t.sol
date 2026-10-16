// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import { DeploymentLog } from "../script/utils/DeploymentLog.sol";

contract DeploymentLogTest is Test {
    function _path() internal view returns (string memory) {
        return string.concat("deployments/", Strings.toString(block.chainid), ".json");
    }

    function test_appendOutsideABroadcastLeavesTheLogUntouched() public {
        vm.chainId(424242);
        string memory path = _path();
        assertFalse(vm.exists(path), "precondition: no log for this chain");

        DeploymentLog.Entry[] memory entries = new DeploymentLog.Entry[](1);
        entries[0] = DeploymentLog.Entry("StrimzRegistry", address(0xA11CE), address(0xB0B));
        DeploymentLog.append("dry-run", address(this), entries);

        bool written = vm.exists(path);
        if (written) vm.removeFile(path);
        assertFalse(written, "a non-broadcast run wrote the deployment log");
    }

    function test_appendSingleOutsideABroadcastLeavesTheLogUntouched() public {
        vm.chainId(424243);
        string memory path = _path();

        DeploymentLog.appendSingle("dry-run", address(this), "TimelockController", address(0xC0DE), address(0xC0DE));

        bool written = vm.exists(path);
        if (written) vm.removeFile(path);
        assertFalse(written, "a non-broadcast run wrote the deployment log");
    }
}
