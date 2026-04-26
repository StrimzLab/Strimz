// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IStrimzAgentEscrow } from "../interfaces/IStrimzAgentEscrow.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzAgentEscrow
/// @notice ERC-8183-style commerce escrow for AI agents.
///         Full lifecycle: createJob → fundJob → startJob → submitDeliverable
///         → approveAndRelease (assessor) or dispute. Funds held in escrow
///         until the neutral assessor approves the deliverable.
/// @custom:oz-upgrades-unsafe-allow constructor
contract StrimzAgentEscrow is IStrimzAgentEscrow, StrimzPausable, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /// @custom:storage-location erc7201:strimz.storage.StrimzAgentEscrow
    struct Storage {
        ITokenWhitelist tokenWhitelist;
        uint256 nextJobId;
        mapping(uint256 jobId => Job data) jobs;
    }

    // keccak256(abi.encode(uint256(keccak256("strimz.storage.StrimzAgentEscrow")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        0x581f84d78ff36607cbbf6bc993acc7a71eef4d93ca2576273abf7aef66a92a00;

    event DependencyUpdated(string name, address newAddress);

    function _s() private pure returns (Storage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, ITokenWhitelist tokenWhitelist_) external initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        Storage storage $ = _s();
        $.tokenWhitelist = tokenWhitelist_;
        $.nextJobId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    function tokenWhitelist() external view returns (ITokenWhitelist) { return _s().tokenWhitelist; }

    function setTokenWhitelist(ITokenWhitelist v) external onlyRole(ADMIN_ROLE) {
        _s().tokenWhitelist = v;
        emit DependencyUpdated("tokenWhitelist", address(v));
    }

    /// @inheritdoc IStrimzAgentEscrow
    function createJob(
        address vendor,
        address assessor,
        address token,
        uint256 amount,
        string calldata description
    ) external override whenNotPaused returns (uint256 jobId) {
        if (amount == 0) revert AgentEscrow__ZeroAmount();
        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert AgentEscrow__InvalidToken(token);

        jobId = $.nextJobId;
        unchecked {
            $.nextJobId = jobId + 1;
        }

        $.jobs[jobId] = Job({
            client: msg.sender,
            vendor: vendor,
            assessor: assessor,
            token: token,
            amount: amount,
            description: description,
            deliverableHash: bytes32(0),
            status: JobStatus.Proposed,
            createdAt: uint64(block.timestamp),
            completedAt: 0
        });

        emit JobCreated(jobId, msg.sender, vendor, token, amount);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function fundJob(uint256 jobId) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.client) revert AgentEscrow__NotClient();
        if (job.status != JobStatus.Proposed) revert AgentEscrow__InvalidState(jobId, job.status);

        IERC20(job.token).safeTransferFrom(msg.sender, address(this), job.amount);
        job.status = JobStatus.Funded;

        emit JobFunded(jobId, job.amount);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function startJob(uint256 jobId) external override whenNotPaused {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.vendor) revert AgentEscrow__NotVendor();
        if (job.status != JobStatus.Funded) revert AgentEscrow__InvalidState(jobId, job.status);
        job.status = JobStatus.InProgress;
        emit JobStarted(jobId);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external override whenNotPaused {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.vendor) revert AgentEscrow__NotVendor();
        if (job.status != JobStatus.InProgress) revert AgentEscrow__InvalidState(jobId, job.status);
        job.deliverableHash = deliverableHash;
        job.status = JobStatus.Delivered;
        emit JobDelivered(jobId, deliverableHash);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function approveAndRelease(uint256 jobId) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.assessor) revert AgentEscrow__NotAssessor();
        if (job.status != JobStatus.Delivered) revert AgentEscrow__InvalidState(jobId, job.status);

        job.status = JobStatus.Completed;
        job.completedAt = uint64(block.timestamp);

        IERC20(job.token).safeTransfer(job.vendor, job.amount);

        emit JobApproved(jobId, msg.sender);
        emit JobReleased(jobId, job.vendor, job.amount);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function dispute(uint256 jobId, string calldata reason) external override whenNotPaused {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.client && msg.sender != job.vendor) revert AgentEscrow__NotParty();
        if (job.status != JobStatus.Delivered && job.status != JobStatus.InProgress) {
            revert AgentEscrow__InvalidState(jobId, job.status);
        }
        job.status = JobStatus.Disputed;
        emit JobDisputed(jobId, reason);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function cancelJob(uint256 jobId, string calldata reason) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.client) revert AgentEscrow__NotClient();
        if (job.status != JobStatus.Proposed && job.status != JobStatus.Funded) {
            revert AgentEscrow__InvalidState(jobId, job.status);
        }
        if (job.status == JobStatus.Funded) {
            IERC20(job.token).safeTransfer(job.client, job.amount);
        }
        job.status = JobStatus.Cancelled;
        emit JobCancelled(jobId, reason);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function getJob(uint256 jobId) external view override returns (Job memory) {
        return _s().jobs[jobId];
    }

    function _loadJob(uint256 jobId) private view returns (Job storage job) {
        job = _s().jobs[jobId];
        if (job.client == address(0)) revert AgentEscrow__UnknownJob(jobId);
    }
}
