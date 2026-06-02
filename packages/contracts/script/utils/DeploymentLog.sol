// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Vm } from "forge-std/Vm.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

/// @title DeploymentLog
/// @notice Append-only audit trail of every Strimz deployment, written as a
///         well-formed JSON array.
///
/// On each deploy script run we record: timestamp, chain id, deployer,
/// a free-form label (e.g. "core" / "agent" / "core-upgrade-v2"), and a
/// list of (contractName, proxy, implementation) tuples.
///
/// Output: `deployments/<chainId>.json`. The file is a top-level JSON
/// array of deployment records, one element per script invocation. The
/// most recent deployment is the last element of the array. Older
/// entries are never overwritten; new entries are appended by
/// rewriting the array with the additional element.
///
/// Consumers can read the file with any standard JSON parser, e.g.:
///
///     jq '.[-1]' deployments/5042002.json     # latest deployment
///     jq '.[0]'  deployments/5042002.json     # first deployment
///     jq '.[] | select(.label == "core")' deployments/5042002.json
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
        string memory path =
            string.concat("deployments/", Strings.toString(block.chainid), ".json");

        string memory entryJson = _serialiseEntry(label, entries);
        string memory updated = _spliceIntoArray(vm, path, entryJson);
        vm.writeFile(path, updated);
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

    // -------- internals --------

    /// @dev Serialises a single deployment record to a JSON object. No
    ///      surrounding `[` or `]`; the caller decides how to splice it
    ///      into the array.
    function _serialiseEntry(string memory label, Entry[] memory entries)
        private
        view
        returns (string memory)
    {
        string memory json = string.concat(
            "{",
            '"timestamp":',
            Strings.toString(block.timestamp),
            ",",
            '"chainId":',
            Strings.toString(block.chainid),
            ",",
            '"deployer":"',
            Strings.toHexString(uint160(tx.origin), 20),
            '",',
            '"label":"',
            label,
            '",',
            '"contracts":['
        );
        for (uint256 i; i < entries.length; ++i) {
            if (i != 0) json = string.concat(json, ",");
            json = string.concat(
                json,
                '{"name":"',
                entries[i].name,
                '","proxy":"',
                Strings.toHexString(uint160(entries[i].proxy), 20),
                '","implementation":"',
                Strings.toHexString(uint160(entries[i].implementation), 20),
                '"}'
            );
        }
        return string.concat(json, "]}");
    }

    /// @dev Splices `entryJson` into the JSON array at `path`. Creates the
    ///      file with `[entryJson]` if it doesn't yet exist. Otherwise
    ///      reads the existing array, strips the trailing `]`, and writes
    ///      back `<prefix>,<entryJson>]` (or `[<entryJson>]` when the
    ///      existing array is empty).
    function _spliceIntoArray(Vm vm, string memory path, string memory entryJson)
        private
        view
        returns (string memory)
    {
        if (!vm.exists(path)) {
            return string.concat("[", entryJson, "]");
        }

        bytes memory existing = bytes(vm.readFile(path));

        // Defensive: trim any trailing newline `vm.writeFile` or a hand
        // edit may have left behind. The format we write never has one,
        // but readers shouldn't break if one shows up.
        uint256 end = existing.length;
        while (end > 0 && (existing[end - 1] == 0x0a || existing[end - 1] == 0x0d)) {
            end--;
        }

        require(
            end >= 2 && existing[0] == "[" && existing[end - 1] == "]",
            "DeploymentLog: existing file is not a JSON array"
        );

        if (end == 2) {
            // Existing file is exactly "[]"; replace with "[<entry>]".
            return string.concat("[", entryJson, "]");
        }

        // Strip the trailing "]" and append ",<entry>]".
        return string.concat(_slice(existing, 0, end - 1), ",", entryJson, "]");
    }

    /// @dev Returns `bytes[start:end]` as a string. Used to drop the
    ///      trailing `]` so we can stitch in another entry.
    function _slice(bytes memory data, uint256 start, uint256 end)
        private
        pure
        returns (string memory)
    {
        bytes memory out = new bytes(end - start);
        for (uint256 i = start; i < end; ++i) {
            out[i - start] = data[i];
        }
        return string(out);
    }
}
