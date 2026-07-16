// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  StrimzAgentEscrow.t
/// @notice Escrow is a state machine holding real customer funds
///         between two counterparties. Every escrow bug in history
///         has the same shape: some state transition is one-way, and
///         one party can grief the other into permanent lock.
///
///         What we prove:
///           1. Happy path terminates in vendor-paid, escrow drained.
///           2. Every intermediate state has an exit — no state can
///              trap funds indefinitely.
///           3. Client-driven cancel refunds while pre-work.
///           4. Timeouts unblock funds when a counterparty goes silent.
///              Standing table:
///                Funded past START_TIMEOUT       → client reclaims
///                InProgress past DELIVERY        → client reclaims
///                Delivered past APPROVAL         → vendor reclaims
///                Disputed past DISPUTE_TIMEOUT   → client reclaims
///              (Vendor cannot reclaim from Disputed — they benefit
///              from a standstill so they don't get to end it early.)
///           5. Dispute resolution splits between parties. Sum must
///              exactly equal the escrow — no dust trapped, no
///              cross-job draining.
///           6. Self-dealing party layouts are rejected at create.
///           7. Uninitialised job status decodes as None, not Proposed.

import { StrimzTestBase } from "./Helpers.t.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { IStrimzAgentEscrow } from "../src/interfaces/IStrimzAgentEscrow.sol";

contract StrimzAgentEscrowTest is StrimzTestBase {
    TokenWhitelist internal whitelist;
    StrimzAgentEscrow internal escrow;
    address internal arbitrator;
    uint256 internal constant AMOUNT = 100_000_000; // 100 USDC

    function setUp() public {
        _setUpTokens();
        whitelist = _deployTokenWhitelist(admin);
        vm.prank(admin);
        whitelist.add(address(usdc));
        escrow = _deployAgentEscrow(admin, whitelist);

        arbitrator = makeAddr("arbitrator");
        // Cache the role selector before pranking — view calls in the
        // argument list eat vm.prank.
        bytes32 resolverRole = escrow.DISPUTE_RESOLVER_ROLE();
        vm.prank(admin);
        escrow.grantRole(resolverRole, arbitrator);

        _fund(payer, 10 * AMOUNT);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ---------- Happy path ----------

    function test_fullLifecycleReleasesToVendor() public {
        uint256 jobId = _createProposed();
        vm.prank(payer);
        escrow.fundJob(jobId);
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT, "escrow holds the funds");

        vm.prank(vendor);
        escrow.startJob(jobId);
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, keccak256("work-hash"));

        uint256 vendorBefore = usdc.balanceOf(vendor);
        vm.prank(assessor);
        escrow.approveAndRelease(jobId);

        assertEq(usdc.balanceOf(vendor) - vendorBefore, AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained");
        assertEq(uint256(escrow.getJob(jobId).status), uint256(IStrimzAgentEscrow.JobStatus.Completed));
    }

    // ---------- Cancel ----------

    function test_clientCancelBeforeFund_noRefund() public {
        uint256 jobId = _createProposed();
        vm.prank(payer);
        escrow.cancelJob(jobId, "changed mind");
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(uint256(escrow.getJob(jobId).status), uint256(IStrimzAgentEscrow.JobStatus.Cancelled));
    }

    // Cancel from Funded refunds the client atomically.
    function test_clientCancelAfterFundRefunds() public {
        uint256 jobId = _createProposed();
        vm.prank(payer);
        escrow.fundJob(jobId);

        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.cancelJob(jobId, "back out");
        assertEq(usdc.balanceOf(payer) - before, AMOUNT, "client got their money back");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // Only the client can cancel — vendor cannot rug via cancel.
    function test_vendorCannotCancel() public {
        uint256 jobId = _createProposed();
        vm.prank(payer);
        escrow.fundJob(jobId);
        vm.prank(vendor);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__NotClient.selector);
        escrow.cancelJob(jobId, "attempt");
    }

    // ---------- Self-deal prevention ----------

    // Client is msg.sender, so passing themselves as vendor is a rug.
    function test_createRejectsClientAsVendor() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__SelfDeal.selector);
        escrow.createJob(payer, assessor, address(usdc), AMOUNT, "job");
    }

    // Vendor as their own assessor lets them auto-approve. The whole
    // point of the assessor is to be a neutral third party.
    function test_createRejectsVendorAsAssessor() public {
        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__SelfDeal.selector);
        escrow.createJob(vendor, vendor, address(usdc), AMOUNT, "job");
    }

    function test_createRejectsZeroAddressParties() public {
        vm.startPrank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__ZeroAddress.selector);
        escrow.createJob(address(0), assessor, address(usdc), AMOUNT, "job");
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__ZeroAddress.selector);
        escrow.createJob(vendor, address(0), address(usdc), AMOUNT, "job");
        vm.stopPrank();
    }

    // ---------- Dispute resolution ----------

    // Resolver splits funds; sum must equal escrow.
    function test_resolveDisputeSplitsBetweenParties() public {
        uint256 jobId = _createInProgress();
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, bytes32("hash"));
        vm.prank(payer);
        escrow.dispute(jobId, "quality issue");

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 vendorBefore = usdc.balanceOf(vendor);

        uint256 toVendor = (AMOUNT * 60) / 100;
        uint256 toClient = AMOUNT - toVendor;
        vm.prank(arbitrator);
        escrow.resolveDispute(jobId, toVendor, toClient);

        assertEq(usdc.balanceOf(vendor) - vendorBefore, toVendor);
        assertEq(usdc.balanceOf(payer) - payerBefore, toClient);

        // Re-resolve rejected.
        vm.prank(arbitrator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzAgentEscrow.AgentEscrow__InvalidState.selector,
                jobId,
                IStrimzAgentEscrow.JobStatus.Resolved
            )
        );
        escrow.resolveDispute(jobId, 0, AMOUNT);
    }

    // Under-payment traps dust; over-payment raids other jobs. Both banned.
    function test_resolveDisputeRejectsSumMismatch() public {
        uint256 jobId = _createInProgress();
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, bytes32("hash"));
        vm.prank(payer);
        escrow.dispute(jobId, "reason");

        vm.prank(arbitrator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzAgentEscrow.AgentEscrow__ResolutionSumMismatch.selector,
                AMOUNT - 1,
                AMOUNT
            )
        );
        escrow.resolveDispute(jobId, AMOUNT / 2, AMOUNT / 2 - 1);

        vm.prank(arbitrator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStrimzAgentEscrow.AgentEscrow__ResolutionSumMismatch.selector,
                AMOUNT + 1,
                AMOUNT
            )
        );
        escrow.resolveDispute(jobId, AMOUNT / 2 + 1, AMOUNT / 2);
    }

    // Random EOAs cannot call resolveDispute.
    function test_resolveDisputeRequiresRole() public {
        uint256 jobId = _createInProgress();
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, bytes32("hash"));
        vm.prank(payer);
        escrow.dispute(jobId, "reason");

        address attacker = makeAddr("attacker");
        bytes32 resolverRole = escrow.DISPUTE_RESOLVER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                attacker,
                resolverRole
            )
        );
        vm.prank(attacker);
        escrow.resolveDispute(jobId, AMOUNT, 0);
    }

    // ---------- Timeout reclaim ----------

    // Vendor never starts → client walks after START_TIMEOUT.
    function test_clientReclaimsFundedAfterStartTimeout() public {
        uint256 jobId = _createProposed();
        vm.prank(payer);
        escrow.fundJob(jobId);

        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__TimeoutNotReached.selector);
        escrow.reclaimAfterTimeout(jobId);

        vm.warp(block.timestamp + escrow.START_TIMEOUT() + 1);
        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(payer) - before, AMOUNT);
    }

    // Vendor abandons an InProgress job → client walks after DELIVERY.
    function test_clientReclaimsInProgressAfterDeliveryTimeout() public {
        uint256 jobId = _createInProgress();
        vm.warp(block.timestamp + escrow.DELIVERY_TIMEOUT() + 1);
        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(payer) - before, AMOUNT);
    }

    // Assessor sleeps on a Delivered job → vendor recovers.
    function test_vendorReclaimsDeliveredAfterApprovalTimeout() public {
        uint256 jobId = _createInProgress();
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, bytes32("hash"));

        vm.warp(block.timestamp + escrow.APPROVAL_TIMEOUT() + 1);
        // Client has no standing here.
        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__NotVendor.selector);
        escrow.reclaimAfterTimeout(jobId);

        uint256 before = usdc.balanceOf(vendor);
        vm.prank(vendor);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(vendor) - before, AMOUNT);
    }

    // Vendor disputes preemptively hoping to trap client funds. After
    // DISPUTE_TIMEOUT the client escapes. Vendor has NO reclaim path
    // from Disputed — they benefit from the standstill.
    function test_clientReclaimsDisputedAfterDisputeTimeout() public {
        uint256 jobId = _createInProgress();
        vm.prank(vendor);
        escrow.dispute(jobId, "preemptive grief");

        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__TimeoutNotReached.selector);
        escrow.reclaimAfterTimeout(jobId);

        vm.warp(block.timestamp + escrow.DISPUTE_TIMEOUT() + 1);
        vm.prank(vendor);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__NotClient.selector);
        escrow.reclaimAfterTimeout(jobId);

        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(payer) - before, AMOUNT, "client fully recovers");
    }

    // ---------- Enum sanity ----------

    // Uninitialised job status must read as None, not Proposed.
    function test_unknownJobStatusIsNone() public view {
        assertEq(uint256(escrow.getJob(9_999).status), uint256(IStrimzAgentEscrow.JobStatus.None));
    }

    // ---------- Helpers ----------

    function _createProposed() private returns (uint256 jobId) {
        vm.prank(payer);
        jobId = escrow.createJob(vendor, assessor, address(usdc), AMOUNT, "job");
    }

    function _createInProgress() private returns (uint256 jobId) {
        jobId = _createProposed();
        vm.prank(payer);
        escrow.fundJob(jobId);
        vm.prank(vendor);
        escrow.startJob(jobId);
    }
}
