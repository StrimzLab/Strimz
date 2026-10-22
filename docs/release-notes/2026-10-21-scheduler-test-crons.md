---
date: 2026-10-21
feature: Scheduler e2e tests no longer race the crons
scope: fix
scenario-impact: none
---

# Scheduler e2e tests no longer race the crons

Closes #340.

## What shipped

- **Test setup:** `apps/scheduler/test/setup/global-setup.ts` now switches off every scheduler cron during e2e tests. Six crons were still running on their real schedules: merchant notifications, payer notifications, gas balance, webhook recovery, session expiry and subscription lapsed.
  - The merchant-notification welcome lane runs every 30 seconds. It emailed merchants that tests had just seeded, so `plan-upgrade.e2e.test.ts` sometimes saw two emails instead of one (PR #338's CI run).
  - Tests already run crons by hand with `tickNow()` / `upgradeNow()`, so nothing relied on the schedules.
- **Guard:** a unit test checks that every `@Cron` in `apps/scheduler/src` reads its schedule from an env var that the e2e setup switches off, so a new cron can't bring the race back.

## Not changed

- Production schedules and the code of every cron.
- The webhook outbox's 4-second `@Interval`.
