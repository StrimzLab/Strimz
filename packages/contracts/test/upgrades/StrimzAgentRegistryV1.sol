// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IStrimzAgentRegistry } from "../../src/interfaces/IStrimzAgentRegistry.sol";
import { StrimzAccessControl } from "../../src/access/StrimzAccessControl.sol";

contract StrimzAgentRegistryV1 is StrimzAccessControl, UUPSUpgradeable {
    /// @custom:storage-location erc7201:strimz.storage.StrimzAgentRegistry
    struct Storage {
        mapping(address agent => IStrimzAgentRegistry.Agent data) agents;
    }

    bytes32 private constant STORAGE_SLOT = 0xa26e5b2843ff6f1567510af84eea0c5dbdabc8b6573bcb79e5dc9cc324001600;

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(AGENT_ADMIN_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    function registerAgent(address agent, bytes32 credentialDigest, string calldata name, string calldata version)
        external
    {
        if (msg.sender != agent) revert IStrimzAgentRegistry.AgentRegistry__NotAgent();
        _s().agents[agent] = IStrimzAgentRegistry.Agent({
            controller: msg.sender,
            credentialDigest: credentialDigest,
            name: name,
            version: version,
            reputationScore: 0,
            registeredAt: uint64(block.timestamp),
            active: true
        });
    }

    function deactivate(address agent) external {
        IStrimzAgentRegistry.Agent storage a = _s().agents[agent];
        if (msg.sender != a.controller && !hasRole(AGENT_ADMIN_ROLE, msg.sender)) {
            revert IStrimzAgentRegistry.AgentRegistry__NotController();
        }
        a.active = false;
    }

    function adjustReputation(address agent, int256 delta) external onlyRole(AGENT_ADMIN_ROLE) {
        _s().agents[agent].reputationScore += delta;
    }
}
