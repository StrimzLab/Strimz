# ADR for Dummies: One shared package for BullMQ queue names and job payloads

- **Status:** Accepted 2026-09-30
- **Date:** 2026-09-30

## The Idea

The API sends background jobs to the scheduler, but it labels them differently from
what the scheduler expects, so the scheduler rejects every one. We put the job
definitions in one shared place that both sides use, so they cannot disagree again.

## What the Person Sees

1. A merchant cancels a subscription in the dashboard. Today the dashboard says
   cancelled, but the on-chain subscription stays active and the payer can still be
   charged. After this change the cancel reaches the chain.
2. A merchant approves an agent job. Today nothing funds the escrow. After this change
   the funding transaction goes out.

## Important Limitation

Jobs that were already rejected before this change are not retried. Those subscriptions
and agent jobs are handled under a separate issue.

## What Changes

- A new internal package holds every background job definition.
- The API, scheduler and agent use that package and drop their own copies.
- A job that does not match its definition now fails where it is created, with a clear
  message, instead of silently in the background.

## What Does Not Change

- The database, the contracts, webhooks, the public API and the SDKs.
