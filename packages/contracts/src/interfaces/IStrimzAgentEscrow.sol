// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IStrimzAgentEscrow
/// @notice ERC-8183 escrow. Lifecycle: propose → fund → start → deliver
///         → approve → release. Dispute path settles via a resolver
///         role; timeout path lets either party recover funds if the
///         other goes silent.
interface IStrimzAgentEscrow {
    /// @dev `None=0` so the zero-slot default isn't a valid status.
    ///      `Resolved` and `Reclaimed` are terminal exits.
    enum JobStatus {
        None,
        Proposed,
        Funded,
        InProgress,
        Delivered,
        Approved,
        Completed,
        Disputed,
        Cancelled,
        Resolved,
        Reclaimed
    }

    /// @dev `statusChangedAt` tracks the last transition so
    ///      `reclaimAfterTimeout` needs no external oracle.
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
        uint64 statusChangedAt;
    }

    event JobCreated(
        uint256 indexed jobId, address indexed client, address indexed vendor, address token, uint256 amount
    );
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event JobStarted(uint256 indexed jobId);
    event JobDelivered(uint256 indexed jobId, bytes32 deliverableHash);
    event JobApproved(uint256 indexed jobId, address indexed assessor);
    event JobReleased(uint256 indexed jobId, address indexed vendor, uint256 amount);
    event JobDisputed(uint256 indexed jobId, address indexed by, string reason);
    event JobCancelled(uint256 indexed jobId, string reason);
    event JobRefunded(uint256 indexed jobId, address indexed to, uint256 amount);
    event JobResolved(uint256 indexed jobId, address indexed resolver, uint256 toVendor, uint256 toClient);
    event JobReclaimed(uint256 indexed jobId, address indexed to, uint256 amount, JobStatus fromStatus);

    error AgentEscrow__InvalidState(uint256 jobId, JobStatus status);
    error AgentEscrow__NotClient();
    error AgentEscrow__NotVendor();
    error AgentEscrow__NotAssessor();
    error AgentEscrow__NotParty();
    error AgentEscrow__ZeroAmount();
    error AgentEscrow__ZeroAddress();
    error AgentEscrow__InvalidToken(address token);
    error AgentEscrow__UnknownJob(uint256 jobId);
    error AgentEscrow__SelfDeal();
    error AgentEscrow__TimeoutNotReached();
    error AgentEscrow__ResolutionSumMismatch(uint256 provided, uint256 expected);
    error AgentEscrow__NonStandardTransfer();

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

    /// @notice Split a Disputed escrow. `toVendor + toClient == job.amount`.
    ///         DISPUTE_RESOLVER_ROLE only.
    function resolveDispute(uint256 jobId, uint256 toVendor, uint256 toClient) external;

    /// @notice Timeout-based recovery. See the contract's `_reclaim`
    ///         table for standing.
    function reclaimAfterTimeout(uint256 jobId) external;

    function getJob(uint256 jobId) external view returns (Job memory);
}
