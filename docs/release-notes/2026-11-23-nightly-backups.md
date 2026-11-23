---
date: 2026-11-23
feature: Nightly encrypted database backups
scope: feat
scenario-impact: none
---

# Nightly encrypted database backups

Issue: #493. ADR: ADR-2026-11-23-nightly-backups.

The mainnet database had no copy off the OVH server. It now gets a nightly encrypted backup in Cloudflare R2, kept for 14 days.

## What changed

- **`infra/backup/strimz-backup.sh`**, run at 02:00 UTC (03:00 WAT) by a systemd timer on the host:
  - dumps the `strimz` database from the running container without stopping it;
  - encrypts the dump with a public key, so the server can't read its own backups;
  - checks that the dump holds `Merchant` and migration data;
  - uploads it to R2 and checks the uploaded size;
  - pings Healthchecks.io. A failed run uploads nothing and pings `/fail`.
- **R2 bucket lock:** nothing can delete or overwrite a backup for 14 days, not even with the server's token. A lifecycle rule removes them after 15 days.
- **`infra/backup/install.sh`:** installs `age`, `rclone`, the script and the timer, and asks for the token and ping URL through hidden prompts.
- **`infra/backup/verify-restore.sh`:** restores a backup into a throwaway Postgres container on your machine and prints row counts.
- **Runbook:** `docs/runbooks/database-restore.md` covers setup, the restore drill and a real restore.
- **Privacy policy:** Cloudflare now also stores encrypted database backups, which are kept for 14 days (8.3). The old 8.3 is now 8.4.

## Rollout

- No image, API, schema or contract change.
- After merge, follow the runbook's **One-time setup**:
  - the key pair;
  - the R2 bucket, lock, lifecycle and token;
  - Healthchecks.io;
  - `install.sh` on the server;
  - the first run.
- Then do one restore drill.

## Verified

- Tests: `apps/api/test/unit/ops/backup-script.test.ts` runs the script against stubbed `docker`, `age`, `rclone` and `curl`:
  - a good run uploads once and pings success;
  - a failed or bad dump uploads nothing and pings `/fail`;
  - the temp files are always removed.
    Removing the safeguards from the script makes the matching tests fail.
- On the server, read-only: `pg_dump` through `pg_restore --list` with draining reads the whole stream; all 35 tables have data entries.
- `verify-restore.sh` restored a test dump into a throwaway container and removed it afterwards.
- `shellcheck` is clean, and `./scripts/preflight.sh` passed in full.
- **Not yet done:** the live setup, the first real backup and the restore drill. They need the founder's keys.
