// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IStrimzAgentRegistry } from "../interfaces/IStrimzAgentRegistry.sol";
import { StrimzAccessControl } from "../access/StrimzAccessControl.sol";

/// @title StrimzAgentRegistry
/// @notice ERC-8004-style on-chain identity for AI agents.
/// @custom:oz-upgrades-unsafe-allow constructor
contract StrimzAgentRegistry is IStrimzAgentRegistry, StrimzAccessControl, UUPSUpgradeable {
    /// @custom:storage-location erc7201:strimz.storage.StrimzAgentRegistry
    struct Storage {
        mapping(address agent => Agent data) agents;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.StrimzAgentRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0xa26e5b2843ff6f1567510af84eea0c5dbdabc8b6573bcb79e5dc9cc324001600;

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

    /// @inheritdoc IStrimzAgentRegistry
    /// @dev Agents self-register. Without this, anyone could squat
    ///      another wallet's identity and rotate its credential.
    function registerAgent(address agent, bytes32 credentialDigest, string calldata name, string calldata version)
        external
        override
    {
        if (agent == address(0)) revert AgentRegistry__ZeroAddress();
        if (msg.sender != agent) revert AgentRegistry__NotAgent();
        Storage storage $ = _s();
        if ($.agents[agent].controller != address(0)) revert AgentRegistry__AlreadyRegistered(agent);

        $.agents[agent] = Agent({
            controller: msg.sender,
            credentialDigest: credentialDigest,
            name: name,
            version: version,
            reputationScore: 0,
            registeredAt: uint64(block.timestamp),
            active: true
        });

        emit AgentRegistered(agent, msg.sender, credentialDigest, name, version);
    }

    /// @inheritdoc IStrimzAgentRegistry
    function rotateCredential(address agent, bytes32 newCredentialDigest) external override {
        Agent storage a = _loadAgent(agent);
        if (msg.sender != a.controller) revert AgentRegistry__NotController();
        a.credentialDigest = newCredentialDigest;
        emit AgentCredentialRotated(agent, newCredentialDigest);
    }

    /// @inheritdoc IStrimzAgentRegistry
    function adjustReputation(address agent, int256 delta) external override onlyRole(AGENT_ADMIN_ROLE) {
        Agent storage a = _loadAgent(agent);
        a.reputationScore += delta;
        emit AgentReputationAdjusted(agent, delta, a.reputationScore);
    }

    /// @inheritdoc IStrimzAgentRegistry
    function deactivate(address agent) external override {
        Agent storage a = _loadAgent(agent);
        if (msg.sender != a.controller && !hasRole(AGENT_ADMIN_ROLE, msg.sender)) {
            revert AgentRegistry__NotController();
        }
        a.active = false;
        emit AgentDeactivated(agent);
    }

    /// @inheritdoc IStrimzAgentRegistry
    function activate(address agent) external override {
        Agent storage a = _loadAgent(agent);
        if (msg.sender != a.controller && !hasRole(AGENT_ADMIN_ROLE, msg.sender)) {
            revert AgentRegistry__NotController();
        }
        a.active = true;
        emit AgentActivated(agent);
    }

    /// @inheritdoc IStrimzAgentRegistry
    function getAgent(address agent) external view override returns (Agent memory) {
        return _s().agents[agent];
    }

    /// @inheritdoc IStrimzAgentRegistry
    function isActive(address agent) external view override returns (bool) {
        Agent storage a = _s().agents[agent];
        return a.controller != address(0) && a.active;
    }

    function _loadAgent(address agent) private view returns (Agent storage a) {
        a = _s().agents[agent];
        if (a.controller == address(0)) revert AgentRegistry__UnknownAgent(agent);
    }
}
