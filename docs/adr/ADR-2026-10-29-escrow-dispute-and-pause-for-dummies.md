# ADR for Dummies: Fair escrow disputes, and pause never traps money

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29

## The Idea

The agent escrow holds a client's money until the vendor's work is done and approved. The audit found two unfair rules.

1. **A dispute could take finished work for free.** After receiving the work, a client could open a dispute and wait. If Strimz didn't settle it within 30 days, the client got all the money back and the vendor got nothing.
2. **Pausing could trap money and pick a winner.** When we paused the escrow, nobody could take money out, but the deadlines kept running. A long pause could make one side miss its deadline through no fault of its own.

## The Fix

1. **A dispute keeps the job heading where it was.**
   - If the work was already delivered, the vendor can claim the money once the dispute has been open for 30 days.
   - If the work wasn't delivered, the client gets the refund.
   - Opening a dispute never helps the person who opened it. Strimz can still settle a dispute any way it decides before then.
2. **Pause only stops new jobs.** While paused, nobody can create or fund a new job. Everything for existing jobs keeps working: starting, delivering, approving, disputing, cancelling, settling and claiming after a deadline.

## What People See

- **Vendors:** delivered work is paid even if a dispute goes unanswered.
- **Clients:** undelivered work is still refunded, and a pause never blocks a refund.
- **Strimz:** a pause is safe to use, because it can't trap anyone's money.

## Important Limitation

- **Pause can't stop existing jobs.** If we ever found a bug in how money leaves the escrow, we'd fix it with an upgrade, not a pause.
- **The escrow is still off for launch.** This makes it correct before it is ever turned on.

## What Does Not Change

- The deadlines: 7, 30, 14 and 30 days.
- Strimz's power to settle a dispute with any split.
- How the dashboard records escrow events.
