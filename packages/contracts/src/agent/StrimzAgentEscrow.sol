// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import { IStrimzAgentEscrow } from "../interfaces/IStrimzAgentEscrow.sol";
import { ITokenWhitelist } from "../interfaces/ITokenWhitelist.sol";
import { StrimzPausable } from "../access/Pausable.sol";

/// @title StrimzAgentEscrow
/// @notice ERC-8183 escrow. Timeouts + dispute resolution guarantee
///         escrowed funds always have a path out.
/// @custom:oz-upgrades-unsafe-allow constructor
contract StrimzAgentEscrow is
    IStrimzAgentEscrow,
    StrimzPausable,
    ReentrancyGuardTransient,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Grant to a multisig in prod. Single admin on testnet is fine.
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("STRIMZ_DISPUTE_RESOLVER_ROLE");

    /// @notice Windows are conservative: vendors get 30 days to deliver,
    ///         assessors get 14 to approve, disputes get 30. Anything
    ///         faster punishes legitimate slow work.
    uint64 public constant START_TIMEOUT    = 7 days;
    uint64 public constant DELIVERY_TIMEOUT = 30 days;
    uint64 public constant APPROVAL_TIMEOUT = 14 days;
    /// @notice Client can walk from a Disputed job after this window.
    ///         Blocks a vendor from disputing preemptively to trap funds.
    uint64 public constant DISPUTE_TIMEOUT  = 30 days;

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
        if (admin == address(0) || address(tokenWhitelist_) == address(0)) {
            revert AgentEscrow__ZeroAddress();
        }
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(DISPUTE_RESOLVER_ROLE, admin);

        Storage storage $ = _s();
        $.tokenWhitelist = tokenWhitelist_;
        $.nextJobId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    function tokenWhitelist() external view returns (ITokenWhitelist) { return _s().tokenWhitelist; }

    function setTokenWhitelist(ITokenWhitelist v) external onlyRole(ADMIN_ROLE) {
        if (address(v) == address(0)) revert AgentEscrow__ZeroAddress();
        _s().tokenWhitelist = v;
        emit DependencyUpdated("tokenWhitelist", address(v));
    }

    // ---------- Lifecycle ----------

    /// @inheritdoc IStrimzAgentEscrow
    function createJob(
        address vendor,
        address assessor,
        address token,
        uint256 amount,
        string calldata description
    ) external override whenNotPaused returns (uint256 jobId) {
        if (amount == 0) revert AgentEscrow__ZeroAmount();
        // The assessor is only meaningful if they're neutral. Same-party
        // layouts let a client rug their own escrow.
        if (vendor == address(0) || assessor == address(0)) revert AgentEscrow__ZeroAddress();
        if (vendor == msg.sender || assessor == msg.sender || vendor == assessor) {
            revert AgentEscrow__SelfDeal();
        }

        Storage storage $ = _s();
        if (!$.tokenWhitelist.isWhitelisted(token)) revert AgentEscrow__InvalidToken(token);

        jobId = $.nextJobId;
        unchecked {
            $.nextJobId = jobId + 1;
        }

        uint64 nowTs = uint64(block.timestamp);
        $.jobs[jobId] = Job({
            client: msg.sender,
            vendor: vendor,
            assessor: assessor,
            token: token,
            amount: amount,
            description: description,
            deliverableHash: bytes32(0),
            status: JobStatus.Proposed,
            createdAt: nowTs,
            completedAt: 0,
            statusChangedAt: nowTs
        });

        emit JobCreated(jobId, msg.sender, vendor, token, amount);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function fundJob(uint256 jobId) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.client) revert AgentEscrow__NotClient();
        if (job.status != JobStatus.Proposed) revert AgentEscrow__InvalidState(jobId, job.status);

        // Balance-delta guard: a fee-on-transfer / rebasing token could
        // credit the pool less than job.amount while we book the full
        // amount, letting a later payout draw from other jobs' escrow.
        uint256 beforeBal = IERC20(job.token).balanceOf(address(this));
        IERC20(job.token).safeTransferFrom(msg.sender, address(this), job.amount);
        if (IERC20(job.token).balanceOf(address(this)) - beforeBal != job.amount) {
            revert AgentEscrow__NonStandardTransfer();
        }
        _setStatus(job, JobStatus.Funded);

        emit JobFunded(jobId, job.amount);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function startJob(uint256 jobId) external override whenNotPaused {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.vendor) revert AgentEscrow__NotVendor();
        if (job.status != JobStatus.Funded) revert AgentEscrow__InvalidState(jobId, job.status);
        _setStatus(job, JobStatus.InProgress);
        emit JobStarted(jobId);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external override whenNotPaused {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.vendor) revert AgentEscrow__NotVendor();
        if (job.status != JobStatus.InProgress) revert AgentEscrow__InvalidState(jobId, job.status);
        job.deliverableHash = deliverableHash;
        _setStatus(job, JobStatus.Delivered);
        emit JobDelivered(jobId, deliverableHash);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function approveAndRelease(uint256 jobId) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.assessor) revert AgentEscrow__NotAssessor();
        if (job.status != JobStatus.Delivered) revert AgentEscrow__InvalidState(jobId, job.status);

        _setStatus(job, JobStatus.Completed);
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
        _setStatus(job, JobStatus.Disputed);
        emit JobDisputed(jobId, msg.sender, reason);
    }

    /// @inheritdoc IStrimzAgentEscrow
    function cancelJob(uint256 jobId, string calldata reason) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        if (msg.sender != job.client) revert AgentEscrow__NotClient();
        if (job.status != JobStatus.Proposed && job.status != JobStatus.Funded) {
            revert AgentEscrow__InvalidState(jobId, job.status);
        }
        uint256 amount = job.amount;
        address token = job.token;
        bool wasFunded = job.status == JobStatus.Funded;
        _setStatus(job, JobStatus.Cancelled);
        if (wasFunded) {
            IERC20(token).safeTransfer(job.client, amount);
            emit JobRefunded(jobId, job.client, amount);
        }
        emit JobCancelled(jobId, reason);
    }

    // ---------- Dispute resolution ----------

    /// @inheritdoc IStrimzAgentEscrow
    function resolveDispute(uint256 jobId, uint256 toVendor, uint256 toClient)
        external
        override
        whenNotPaused
        onlyRole(DISPUTE_RESOLVER_ROLE)
        nonReentrant
    {
        Job storage job = _loadJob(jobId);
        if (job.status != JobStatus.Disputed) revert AgentEscrow__InvalidState(jobId, job.status);
        // Split must exhaust the escrow. Anything less traps dust;
        // anything more raids another job.
        uint256 expected = job.amount;
        if (toVendor + toClient != expected) {
            revert AgentEscrow__ResolutionSumMismatch(toVendor + toClient, expected);
        }
        _setStatus(job, JobStatus.Resolved);
        job.completedAt = uint64(block.timestamp);
        if (toVendor > 0) IERC20(job.token).safeTransfer(job.vendor, toVendor);
        if (toClient > 0) IERC20(job.token).safeTransfer(job.client, toClient);
        emit JobResolved(jobId, msg.sender, toVendor, toClient);
    }

    // ---------- Timeout reclaim ----------

    /// @inheritdoc IStrimzAgentEscrow
    /// @dev Standing:
    ///        client → Funded past START_TIMEOUT
    ///        client → InProgress past DELIVERY_TIMEOUT
    ///        vendor → Delivered past APPROVAL_TIMEOUT
    ///        client → Disputed past DISPUTE_TIMEOUT
    ///      Proposed jobs hold no escrow, so no reclaim.
    function reclaimAfterTimeout(uint256 jobId) external override whenNotPaused nonReentrant {
        Job storage job = _loadJob(jobId);
        JobStatus status = job.status;
        uint64 changedAt = job.statusChangedAt;
        uint64 nowTs = uint64(block.timestamp);
        address recipient;
        uint64 window;

        if (status == JobStatus.Funded) {
            if (msg.sender != job.client) revert AgentEscrow__NotClient();
            recipient = job.client;
            window = START_TIMEOUT;
        } else if (status == JobStatus.InProgress) {
            if (msg.sender != job.client) revert AgentEscrow__NotClient();
            recipient = job.client;
            window = DELIVERY_TIMEOUT;
        } else if (status == JobStatus.Delivered) {
            if (msg.sender != job.vendor) revert AgentEscrow__NotVendor();
            recipient = job.vendor;
            window = APPROVAL_TIMEOUT;
        } else if (status == JobStatus.Disputed) {
            // Vendor benefits from a standstill, so only the client
            // gets a reclaim path from Disputed.
            if (msg.sender != job.client) revert AgentEscrow__NotClient();
            recipient = job.client;
            window = DISPUTE_TIMEOUT;
        } else {
            revert AgentEscrow__InvalidState(jobId, status);
        }

        if (nowTs < changedAt + window) revert AgentEscrow__TimeoutNotReached();

        uint256 amount = job.amount;
        _setStatus(job, JobStatus.Reclaimed);
        job.completedAt = nowTs;
        IERC20(job.token).safeTransfer(recipient, amount);
        emit JobReclaimed(jobId, recipient, amount, status);
    }

    // ---------- Views ----------

    /// @inheritdoc IStrimzAgentEscrow
    function getJob(uint256 jobId) external view override returns (Job memory) {
        return _s().jobs[jobId];
    }

    // ---------- Internals ----------

    function _loadJob(uint256 jobId) private view returns (Job storage job) {
        job = _s().jobs[jobId];
        if (job.client == address(0)) revert AgentEscrow__UnknownJob(jobId);
    }

    /// @dev Stamp every status change so `reclaimAfterTimeout` has a
    ///      single field to compare against.
    function _setStatus(Job storage job, JobStatus next) private {
        job.status = next;
        job.statusChangedAt = uint64(block.timestamp);
    }
}
