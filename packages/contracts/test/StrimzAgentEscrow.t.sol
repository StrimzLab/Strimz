// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StrimzTestBase } from "./Helpers.t.sol";
import { TokenWhitelist } from "../src/tokens/TokenWhitelist.sol";
import { StrimzAgentEscrow } from "../src/agent/StrimzAgentEscrow.sol";
import { IStrimzAgentEscrow } from "../src/interfaces/IStrimzAgentEscrow.sol";

contract StrimzAgentEscrowTest is StrimzTestBase {
    TokenWhitelist internal whitelist;
    StrimzAgentEscrow internal escrow;

    function setUp() public {
        _setUpTokens();
        whitelist = _deployTokenWhitelist(admin);
        vm.prank(admin);
        whitelist.add(address(usdc));
        escrow = _deployAgentEscrow(admin, whitelist);

        _fund(payer, 1_000_000_000);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_fullLifecycle() public {
        vm.prank(payer);
        uint256 jobId = escrow.createJob(vendor, assessor, address(usdc), 100_000_000, "Build thing");

        vm.prank(payer);
        escrow.fundJob(jobId);
        assertEq(usdc.balanceOf(address(escrow)), 100_000_000);

        vm.prank(vendor);
        escrow.startJob(jobId);

        vm.prank(vendor);
        escrow.submitDeliverable(jobId, keccak256("artefact"));

        vm.prank(assessor);
        escrow.approveAndRelease(jobId);

        assertEq(usdc.balanceOf(vendor), 100_000_000);
        assertEq(uint256(escrow.getJob(jobId).status), uint256(IStrimzAgentEscrow.JobStatus.Completed));
    }

    function test_clientCanCancelBeforeFunded() public {
        vm.prank(payer);
        uint256 jobId = escrow.createJob(vendor, assessor, address(usdc), 50_000_000, "x");

        vm.prank(payer);
        escrow.cancelJob(jobId, "changed mind");

        assertEq(uint256(escrow.getJob(jobId).status), uint256(IStrimzAgentEscrow.JobStatus.Cancelled));
    }

    function test_uninitialisedJobStatusIsNone() public view {
        // Critical: an unset mapping slot must NOT read as Proposed (index 1).
        // Default storage value is 0, which we mapped to JobStatus.None.
        assertEq(uint256(escrow.getJob(9_999).status), uint256(IStrimzAgentEscrow.JobStatus.None));
    }
}
