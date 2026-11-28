---
date: 2026-11-28
feature: Merchant on-chain registration retries itself, safely
scope: fix
scenario-impact: none
---

# Merchant on-chain registration retries itself, safely

[ADR-2026-11-28-registration-retry](../adr/ADR-2026-11-28-registration-retry.md) (#577).

## The problem

On 2026-11-27 a test account's registration reverted. Even after the cause was fixed, nothing registered it:

- The failed job kept its id, and BullMQ silently ignored later requests with that id.
- Nothing retried on its own.
- A blind retry wasn't safe either. The registry doesn't refuse a second registration for the same owner, so sending again while the first transaction might still land could give a merchant two ids.

## What changed

- **The earlier transaction decides.** Strimz now records the nonce and sender with each registration transaction (two nullable `Merchant` columns, one migration). On a retry:
  - **it succeeded:** link the id;
  - **it reverted:** send again;
  - **no receipt, and its nonce has since been used:** it can never land, so send again;
  - **no receipt, and the nonce is still unused:** wait.
- **Failed jobs no longer block retries.** Re-queueing clears a failed job with the same id first. Live and finished jobs are never touched.
- **A sweep every 10 minutes** (scheduler, `registration-retry`) re-queues up to 25 stuck merchants. A merchant is stuck if onboarded, unregistered, and last requested over 10 minutes ago. It keeps each merchant's booked day under the daily registration cap.
- **Ops alert:** an email to `STRIMZ_ADMIN_ALERT_EMAIL` after about an hour of retries, once a day per merchant.
- **Shared queue options:** the relay job options moved to `@strimz/queue-contracts` (`relaySubmissionJobOptions`), so the API and the scheduler queue the same way.

## Deploy

Apply the migration on both backends before the new image starts; the container's start-up runs migrations. Nothing else needs configuring.
