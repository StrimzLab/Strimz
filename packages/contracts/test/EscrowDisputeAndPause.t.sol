// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { StrimzTestBase } from "./Helpers.t.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { IStrimzAgentEscrow } from "../src/interfaces/IStrimzAgentEscrow.sol";

contract EscrowDisputeAndPauseTest is StrimzTestBase {
    uint256 internal constant AMOUNT = 100_000_000;

    StrimzAgentEscrow internal escrow;
    address internal resolver;

    function setUp() public {
        _setUpTokens();
        TokenWhitelist whitelist = _deployTokenWhitelist(admin);
        vm.prank(admin);
        whitelist.add(address(usdc));
        escrow = _deployAgentEscrow(admin, whitelist);

        resolver = makeAddr("resolver");
        bytes32 role = escrow.DISPUTE_RESOLVER_ROLE();
        vm.prank(admin);
        escrow.grantRole(role, resolver);

        _fund(payer, 10 * AMOUNT);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ---------- Unanswered disputes ----------

    function test_clientCannotReclaimDeliveredJobAfterSilentDispute() public {
        uint256 jobId = _delivered();
        vm.prank(payer);
        escrow.dispute(jobId, "keep the work, get a refund");
        vm.warp(block.timestamp + escrow.DISPUTE_TIMEOUT() + 1);

        vm.prank(payer);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__NotVendor.selector);
        escrow.reclaimAfterTimeout(jobId);
    }

    function test_vendorClaimsDeliveredJobAfterSilentDispute() public {
        uint256 jobId = _delivered();
        vm.prank(payer);
        escrow.dispute(jobId, "unhappy");
        vm.warp(block.timestamp + escrow.DISPUTE_TIMEOUT() + 1);

        uint256 before = usdc.balanceOf(vendor);
        vm.prank(vendor);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(vendor) - before, AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_vendorDisputingDeliveredJobWaitsTheFullDisputeWindow() public {
        uint256 jobId = _delivered();
        vm.prank(vendor);
        escrow.dispute(jobId, "approve me");
        vm.warp(block.timestamp + escrow.APPROVAL_TIMEOUT() + 1);

        vm.prank(vendor);
        vm.expectRevert(IStrimzAgentEscrow.AgentEscrow__TimeoutNotReached.selector);
        escrow.reclaimAfterTimeout(jobId);
    }

    function test_resolverCanStillSplitDeliveredDisputeBeforeTimeout() public {
        uint256 jobId = _delivered();
        vm.prank(payer);
        escrow.dispute(jobId, "partial");
        vm.warp(block.timestamp + escrow.DISPUTE_TIMEOUT() - 1);

        vm.prank(resolver);
        escrow.resolveDispute(jobId, AMOUNT / 4, AMOUNT - AMOUNT / 4);
        assertEq(usdc.balanceOf(vendor), AMOUNT / 4);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_disputedFromRecordsThePreDisputeStatus() public {
        uint256 delivered = _delivered();
        vm.prank(payer);
        escrow.dispute(delivered, "after delivery");

        uint256 inProgress = _funded();
        vm.prank(vendor);
        escrow.startJob(inProgress);
        vm.prank(payer);
        escrow.dispute(inProgress, "before delivery");

        assertEq(uint256(escrow.disputedFrom(delivered)), uint256(IStrimzAgentEscrow.JobStatus.Delivered));
        assertEq(uint256(escrow.disputedFrom(inProgress)), uint256(IStrimzAgentEscrow.JobStatus.InProgress));
        assertEq(uint256(escrow.disputedFrom(_funded())), uint256(IStrimzAgentEscrow.JobStatus.None));
    }

    // ---------- Pause stops new escrow only ----------

    function test_createJobRevertsWhilePaused() public {
        _pause();
        vm.prank(payer);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        escrow.createJob(vendor, assessor, address(usdc), AMOUNT, "job");
    }

    function test_fundJobRevertsWhilePaused() public {
        uint256 jobId = _proposed();
        _pause();
        vm.prank(payer);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        escrow.fundJob(jobId);
    }

    function test_startAndDeliverWorkWhilePaused() public {
        uint256 jobId = _funded();
        _pause();
        vm.prank(vendor);
        escrow.startJob(jobId);
        vm.prank(vendor);
        escrow.submitDeliverable(jobId, keccak256("work"));
        assertEq(uint256(escrow.getJob(jobId).status), uint256(IStrimzAgentEscrow.JobStatus.Delivered));
    }

    function test_approveWorksWhilePaused() public {
        uint256 jobId = _delivered();
        _pause();
        vm.prank(assessor);
        escrow.approveAndRelease(jobId);
        assertEq(usdc.balanceOf(vendor), AMOUNT);
    }

    function test_disputeAndResolveWorkWhilePaused() public {
        uint256 jobId = _delivered();
        _pause();
        vm.prank(payer);
        escrow.dispute(jobId, "paused dispute");
        vm.prank(resolver);
        escrow.resolveDispute(jobId, AMOUNT / 2, AMOUNT / 2);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_cancelRefundsWhilePaused() public {
        uint256 jobId = _funded();
        _pause();
        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.cancelJob(jobId, "paused cancel");
        assertEq(usdc.balanceOf(payer) - before, AMOUNT);
    }

    function test_reclaimWorksWhilePaused() public {
        uint256 jobId = _funded();
        _pause();
        vm.warp(block.timestamp + escrow.START_TIMEOUT() + 1);
        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        escrow.reclaimAfterTimeout(jobId);
        assertEq(usdc.balanceOf(payer) - before, AMOUNT);
    }

    // ---------- Helpers ----------

    function _pause() private {
        vm.prank(admin);
        escrow.pause();
    }

    function _proposed() private returns (uint256 jobId) {
        vm.prank(payer);
        jobId = escrow.createJob(vendor, assessor, address(usdc), AMOUNT, "job");
    }

    function _funded() private returns (uint256 jobId) {
        jobId = _proposed();
        vm.prank(payer);
        escrow.fundJob(jobId);
    }

    function _delivered() private returns (uint256 jobId) {
        jobId = _funded();
        vm.startPrank(vendor);
        escrow.startJob(jobId);
        escrow.submitDeliverable(jobId, keccak256("work"));
        vm.stopPrank();
    }
}
