---
date: 2026-10-15
feature: Agent escrow is hidden for launch; the escrow contract is paused at the redeploy
scope: feat
scenario-impact: none
---

# Hide agent escrow for launch

Resolves #145 for agent escrow. ADR:
[ADR-2026-10-15-hide-escrow-and-cctp-for-launch](../adr/ADR-2026-10-15-hide-escrow-and-cctp-for-launch.md)
([plain-English version](../adr/ADR-2026-10-15-hide-escrow-and-cctp-for-launch-for-dummies.md)),
accepted 2026-10-15. CCTP is left as it is: cross-chain funding will come from Whisk. The
escrow work is tracked in #257.

## What shipped

- **`AGENT_CAPABILITIES[id].available`** in `@strimz/shared-config` (minor). `commerce` is
  `false`; every other capability, including `routing`, is `true`.
- **API.**
  - Turning on `commerce` answers `403 capability_unavailable`. A merchant whose stored
    config already lists it can still save other settings and turn it off.
  - `POST /v1/agents/jobs` and `POST /v1/agents/jobs/:id/approve` answer
    `403 capability_unavailable` before any write or queue job.
  - Listing and retrieving jobs still work. The SDK is unchanged.
- **Agent:** the monthly commerce summary is not scheduled.
- **Dashboard.**
  - **Agents page:** the Commerce card reads "Coming soon". The Jobs tab, the job dialog
    and the commerce settings are gone from the page. The job tab and job detail move to
    `components/dashboard/agents/` for later.
  - **Webhooks:** the event picker leaves out `agent.job_*`.
  - **Footer:** no longer mentions escrow.
- **Redeploy.** After the handoff, the Safe pauses the new `StrimzAgentEscrow`, and
  `Verify` (`handed-off`) refuses an unpaused escrow. The July escrow is paused with the
  old Payments and Subscriptions. The rehearsal pauses it as the Safe.
- **Docs.**
  - Escrow is marked "not available at launch" across the API, dashboard, guide and
    concept pages.
  - The per-plan API rate-limit claim is removed.
  - The docs index no longer says anomaly alerts are on every plan.

## Operator steps

At the redeploy (#142), follow the updated runbook section 4: a Safe transaction calling
`pause()` on the new escrow, before `Verify`. Section 6 also pauses the July escrow.

## Verification

- **Red, then green:**
  - `shared-config` `agents.test.ts`: 6 failed.
  - API `agents-escrow-hidden.e2e.test.ts`: the 3 refusal tests failed; the 3 "still
    works" tests passed throughout.
  - Agent `cron-config`: the commerce cron was scheduled.
  - Web `agent-escrow-hidden.test.ts` (5) and `webhook-events.test.ts` failed.
  - The rehearsal failed at `Verify` (`handed-off`) with "AgentEscrow is not paused", and
    passes with the Safe pause step.
- **Changed tests:** the API job-logic tests (auto-approve, human approval, commerce
  disabled) now call `AgentsService` directly, with the same assertions. The HTTP edge
  refuses before reaching it.
- **On-chain read (2026-10-15):** the July escrow `0x3e34…9b1e` is not paused; a simulated
  `pause()` from the July admin succeeds and one from another address reverts.
- **Results:**
  - API e2e: 342 of 342;
  - agent e2e: 51 of 51;
  - web: 333 of 333;
  - `./scripts/preflight.sh` in full.
