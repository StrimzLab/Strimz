// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, StdInvariant } from "forge-std/Test.sol";
import { StrimzTestBase, MockUsdc } from "../Helpers.t.sol";
import { TokenWhitelist } from "../../src/tokens/TokenWhitelist.sol";
import { StrimzAgentEscrow } from "../../src/agent/StrimzAgentEscrow.sol";
import { IStrimzAgentEscrow } from "../../src/interfaces/IStrimzAgentEscrow.sol";

contract AgentEscrowHandler is Test {
    StrimzAgentEscrow public immutable ESCROW;
    MockUsdc public immutable USDC;
    address public immutable VENDOR;
    address public immutable ASSESSOR;

    address[2] internal clients;
    uint256[] internal jobIds;

    constructor(StrimzAgentEscrow escrow, MockUsdc usdc, address vendor, address assessor) {
        ESCROW = escrow;
        USDC = usdc;
        VENDOR = vendor;
        ASSESSOR = assessor;
        for (uint256 i; i < clients.length; i++) {
            clients[i] = makeAddr(string.concat("invariant.client.", vm.toString(i)));
            USDC.mint(clients[i], 1_000_000_000_000);
            vm.prank(clients[i]);
            USDC.approve(address(ESCROW), type(uint256).max);
        }
    }

    function jobCount() external view returns (uint256) {
        return jobIds.length;
    }

    function jobAt(uint256 i) external view returns (uint256) {
        return jobIds[i];
    }

    function create(uint8 clientIdx, uint64 amountIn) external {
        if (ESCROW.paused() || jobIds.length >= 40) return;
        uint256 amount = (uint256(amountIn) % 10_000_000_000) + 1;
        vm.prank(clients[clientIdx % clients.length]);
        jobIds.push(ESCROW.createJob(VENDOR, ASSESSOR, address(USDC), amount, "job"));
    }

    function fund(uint8 idx) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (!ok || ESCROW.paused() || job.status != IStrimzAgentEscrow.JobStatus.Proposed) return;
        vm.prank(job.client);
        ESCROW.fundJob(id);
    }

    function start(uint8 idx) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (!ok || job.status != IStrimzAgentEscrow.JobStatus.Funded) return;
        vm.prank(VENDOR);
        ESCROW.startJob(id);
    }

    function deliver(uint8 idx) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (!ok || job.status != IStrimzAgentEscrow.JobStatus.InProgress) return;
        vm.prank(VENDOR);
        ESCROW.submitDeliverable(id, keccak256(abi.encode(id)));
    }

    function approve(uint8 idx) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (!ok || job.status != IStrimzAgentEscrow.JobStatus.Delivered) return;
        vm.prank(ASSESSOR);
        ESCROW.approveAndRelease(id);
    }

    function dispute(uint8 idx, bool byVendor) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (
            !ok
                || (job.status != IStrimzAgentEscrow.JobStatus.InProgress
                    && job.status != IStrimzAgentEscrow.JobStatus.Delivered)
        ) return;
        vm.prank(byVendor ? VENDOR : job.client);
        ESCROW.dispute(id, "invariant");
    }

    function cancel(uint8 idx) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (
            !ok
                || (job.status != IStrimzAgentEscrow.JobStatus.Proposed
                    && job.status != IStrimzAgentEscrow.JobStatus.Funded)
        ) return;
        vm.prank(job.client);
        ESCROW.cancelJob(id, "invariant");
    }

    function resolve(uint8 idx, uint64 vendorShareIn) external {
        (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) = _pick(idx);
        if (!ok || job.status != IStrimzAgentEscrow.JobStatus.Disputed) return;
        uint256 toVendor = uint256(vendorShareIn) % (job.amount + 1);
        ESCROW.resolveDispute(id, toVendor, job.amount - toVendor);
    }

    function reclaim(uint8 idx) external {
        (uint256 id,, bool ok) = _pick(idx);
        if (!ok) return;
        (address caller, uint64 readyAt) = exitFor(id);
        if (caller == address(0) || block.timestamp < readyAt) return;
        vm.prank(caller);
        ESCROW.reclaimAfterTimeout(id);
    }

    function warp(uint32 secondsIn) external {
        vm.warp(block.timestamp + bound(secondsIn, 1, 20 days));
    }

    function togglePause() external {
        if (ESCROW.paused()) ESCROW.unpause();
        else ESCROW.pause();
    }

    /// Who can reclaim an open job, and from when. Zero caller for closed jobs.
    function exitFor(uint256 id) public view returns (address caller, uint64 readyAt) {
        IStrimzAgentEscrow.Job memory job = ESCROW.getJob(id);
        IStrimzAgentEscrow.JobStatus s = job.status;
        if (s == IStrimzAgentEscrow.JobStatus.Funded) {
            return (job.client, job.statusChangedAt + ESCROW.START_TIMEOUT());
        }
        if (s == IStrimzAgentEscrow.JobStatus.InProgress) {
            return (job.client, job.statusChangedAt + ESCROW.DELIVERY_TIMEOUT());
        }
        if (s == IStrimzAgentEscrow.JobStatus.Delivered) {
            return (VENDOR, job.statusChangedAt + ESCROW.APPROVAL_TIMEOUT());
        }
        if (s == IStrimzAgentEscrow.JobStatus.Disputed) {
            address to = ESCROW.disputedFrom(id) == IStrimzAgentEscrow.JobStatus.Delivered ? VENDOR : job.client;
            return (to, job.statusChangedAt + ESCROW.DISPUTE_TIMEOUT());
        }
        return (address(0), 0);
    }

    function _pick(uint8 idx) private view returns (uint256 id, IStrimzAgentEscrow.Job memory job, bool ok) {
        if (jobIds.length == 0) return (0, job, false);
        id = jobIds[idx % jobIds.length];
        job = ESCROW.getJob(id);
        ok = true;
    }
}

/// The escrow holds exactly the money of its open jobs, and every open
/// job can still be reclaimed by someone, paused or not.
contract AgentEscrowInvariantsTest is StdInvariant, StrimzTestBase {
    StrimzAgentEscrow internal escrow;
    AgentEscrowHandler internal handler;

    function setUp() public {
        _setUpTokens();
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        vm.prank(admin);
        whitelist.add(address(usdc));
        escrow = _deployAgentEscrow(admin, whitelist);

        handler = new AgentEscrowHandler(escrow, usdc, vendor, assessor);
        bytes32 pauser = escrow.PAUSER_ROLE();
        bytes32 adminRole = escrow.ADMIN_ROLE();
        bytes32 resolverRole = escrow.DISPUTE_RESOLVER_ROLE();
        vm.startPrank(admin);
        escrow.grantRole(pauser, address(handler));
        escrow.grantRole(adminRole, address(handler));
        escrow.grantRole(resolverRole, address(handler));
        vm.stopPrank();
        targetContract(address(handler));
    }

    function invariant_escrowHoldsExactlyTheOpenJobs() public view {
        uint256 open;
        uint256 n = handler.jobCount();
        for (uint256 i; i < n; i++) {
            uint256 id = handler.jobAt(i);
            (address caller,) = handler.exitFor(id);
            if (caller != address(0)) open += escrow.getJob(id).amount;
        }
        assertEq(usdc.balanceOf(address(escrow)), open);
    }

    function invariant_everyOpenJobCanBeReclaimed() public {
        uint256 n = handler.jobCount();
        for (uint256 i; i < n; i++) {
            uint256 id = handler.jobAt(i);
            (address caller, uint64 readyAt) = handler.exitFor(id);
            if (caller == address(0)) continue;

            uint256 snap = vm.snapshotState();
            if (block.timestamp < readyAt) vm.warp(readyAt);
            uint256 amount = escrow.getJob(id).amount;
            uint256 before = usdc.balanceOf(caller);
            vm.prank(caller);
            escrow.reclaimAfterTimeout(id);
            assertEq(usdc.balanceOf(caller) - before, amount);
            vm.revertToState(snap);
        }
    }
}
