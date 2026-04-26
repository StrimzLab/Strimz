// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Vm } from "forge-std/Vm.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

/// @title DeploymentLog
/// @notice Append-only audit trail of every Strimz deployment.
///
/// On each deploy script run we record: timestamp, chain id, deployer,
/// a free-form label (e.g. "core" / "agent" / "core-upgrade-v2"), and a
/// list of (contractName, proxy, implementation) tuples.
///
/// Output: `deployments/<chainId>.jsonl` — one JSON object per line. Tools
/// can read the last line for "current addresses" or scan the file for
/// historical state. The file is **append-only**; previous entries are
/// never overwritten.
library DeploymentLog {
    struct Entry {
        string name;
        address proxy;
        address implementation;
    }

    /// @dev Foundry's `Vm` interface is conventionally accessed at this
    ///      address. Library callers can rely on this constant rather than
    ///      passing `vm` through every helper signature.
    address private constant CHEATCODE_ADDRESS = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;

    function append(string memory label, Entry[] memory entries) internal {
        Vm vm = Vm(CHEATCODE_ADDRESS);

        string memory path = string.concat("deployments/", Strings.toString(block.chainid), ".jsonl");

        // Build the JSON object on a single line. Manual concatenation keeps
        // the dependency surface small and the output stable across
        // Solidity / forge-std versions.
        string memory json = string.concat(
            "{",
            '"timestamp":', Strings.toString(block.timestamp), ",",
            '"chainId":', Strings.toString(block.chainid), ",",
            '"deployer":"', Strings.toHexString(uint160(tx.origin), 20), '",',
            '"label":"', label, '",',
            '"contracts":['
        );
        for (uint256 i; i < entries.length; ++i) {
            if (i != 0) json = string.concat(json, ",");
            json = string.concat(
                json,
                '{"name":"', entries[i].name, '",',
                '"proxy":"', Strings.toHexString(uint160(entries[i].proxy), 20), '",',
                '"implementation":"', Strings.toHexString(uint160(entries[i].implementation), 20), '"}'
            );
        }
        json = string.concat(json, "]}");

        vm.writeLine(path, json);
    }

    /// @dev Convenience wrapper: log a single entry (for cases where a
    ///      script only deploys one proxy).
    function appendSingle(string memory label, string memory name, address proxy, address impl)
        internal
    {
        Entry[] memory entries = new Entry[](1);
        entries[0] = Entry({ name: name, proxy: proxy, implementation: impl });
        append(label, entries);
    }
}
