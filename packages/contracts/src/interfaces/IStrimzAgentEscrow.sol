// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzAgentEscrow
/// @notice ERC-8183 — AI Agent Commerce & Escrow.
///         Full job lifecycle: propose → fund → deliver → approve → release.
///         The neutral `assessor` address verifies deliverables.
interface IStrimzAgentEscrow {
    /// @dev `None` MUST remain the first variant so that the default (zero)
    ///      value of an uninitialised storage slot is never a valid status.
    ///      `createJob` explicitly sets status to `Proposed` on creation.
    enum JobStatus {
        None,
        Proposed,
        Funded,
        InProgress,
        Delivered,
        Approved,
        Completed,
        Disputed,
        Cancelled
    }

    struct Job {
        address client;
        address vendor;
        address assessor;
        address token;
        uint256 amount;
        string description;
        bytes32 deliverableHash;
        JobStatus status;
        uint64 createdAt;
        uint64 completedAt;
    }

    event JobCreated(
        uint256 indexed jobId, address indexed client, address indexed vendor, address token, uint256 amount
    );
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event JobStarted(uint256 indexed jobId);
    event JobDelivered(uint256 indexed jobId, bytes32 deliverableHash);
    event JobApproved(uint256 indexed jobId, address indexed assessor);
    event JobReleased(uint256 indexed jobId, address indexed vendor, uint256 amount);
    event JobDisputed(uint256 indexed jobId, string reason);
    event JobCancelled(uint256 indexed jobId, string reason);

    error AgentEscrow__InvalidState(uint256 jobId, JobStatus status);
    error AgentEscrow__NotClient();
    error AgentEscrow__NotVendor();
    error AgentEscrow__NotAssessor();
    error AgentEscrow__NotParty();
    error AgentEscrow__ZeroAmount();
    error AgentEscrow__InvalidToken(address token);
    error AgentEscrow__UnknownJob(uint256 jobId);

    function createJob(
        address vendor,
        address assessor,
        address token,
        uint256 amount,
        string calldata description
    ) external returns (uint256 jobId);

    function fundJob(uint256 jobId) external;
    function startJob(uint256 jobId) external;
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external;
    function approveAndRelease(uint256 jobId) external;
    function dispute(uint256 jobId, string calldata reason) external;
    function cancelJob(uint256 jobId, string calldata reason) external;

    function getJob(uint256 jobId) external view returns (Job memory);
}
