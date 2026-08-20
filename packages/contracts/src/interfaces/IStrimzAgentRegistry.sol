// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzAgentRegistry
/// @notice ERC-8004 — AI Agent Identity & Reputation.
///         Agents register an on-chain identity with a cryptographic
///         credential digest and accumulate reputation by completing
///         ERC-8183 jobs or other verifiable actions.
interface IStrimzAgentRegistry {
    struct Agent {
        address controller;
        bytes32 credentialDigest;
        string name;
        string version;
        int256 reputationScore;
        uint64 registeredAt;
        bool active;
    }

    event AgentRegistered(
        address indexed agent, address indexed controller, bytes32 credentialDigest, string name, string version
    );
    event AgentCredentialRotated(address indexed agent, bytes32 newCredentialDigest);
    event AgentReputationAdjusted(address indexed agent, int256 delta, int256 newScore);
    event AgentDeactivated(address indexed agent);
    event AgentActivated(address indexed agent);

    error AgentRegistry__AlreadyRegistered(address agent);
    error AgentRegistry__UnknownAgent(address agent);
    error AgentRegistry__NotController();
    error AgentRegistry__NotAgent();
    error AgentRegistry__ZeroAddress();

    function registerAgent(address agent, bytes32 credentialDigest, string calldata name, string calldata version)
        external;

    function rotateCredential(address agent, bytes32 newCredentialDigest) external;
    function adjustReputation(address agent, int256 delta) external;
    function deactivate(address agent) external;

    /// @notice Restore a deactivated agent. Same standing as `deactivate`:
    ///         the agent's controller, or AGENT_ADMIN_ROLE.
    function activate(address agent) external;

    function getAgent(address agent) external view returns (Agent memory);
    function isActive(address agent) external view returns (bool);
}
