---
date: 2026-11-24
feature: Nightly backups go to Cloudinary
scope: feat
scenario-impact: none
---

# Nightly backups go to Cloudinary

Issue: #493. ADR: ADR-2026-11-23-nightly-backups (amendment 2026-11-24).

Cloudflare R2 needs a payment card even on its free tier, so the nightly encrypted backups go to Cloudinary's free plan instead. Nothing had been set up on R2 yet.

## What changed

- **`strimz-backup.sh`:** uploads with `curl` to Cloudinary's Upload API as a `raw` file.
  - It uses an unsigned upload preset. Unsigned uploads can't overwrite or delete, so the server can add backups but never remove or replace them. The server holds no Cloudinary API key or secret.
  - The run fails, with a `/fail` ping, if:
    - the upload fails (Cloudinary's error is logged);
    - the stored size doesn't match;
    - the file wasn't stored with Authenticated delivery.
- **`install.sh`:** installs only `age` now; `rclone` is gone. It asks for the cloud name and, hidden, the preset name.
- **`prune.py`** (new): the founder's monthly cleanup on their Mac. It deletes backups older than 30 days and always keeps the newest 7. It lists by default and needs `--delete` to act.
- **Runbook:** Cloudinary setup, the monthly cleanup, rotating a leaked preset, and downloading a backup for the drill.
- **Privacy policy:** Cloudinary is listed for encrypted database backups, and Cloudflare no longer is. Backups are kept for up to 60 days (8.3).

## Rollout

No image, API, schema or contract change. Follow the runbook's **One-time setup**.

## Verified

- Tests: `backup-script.test.ts` (8) covers:
  - the upload with the preset and path;
  - a failed dump, a dump that exits with an error, and a dump without merchant data;
  - a failed upload, with Cloudinary's message logged;
  - a size mismatch;
  - a public delivery type;
  - missing config.
    Removing the size check or the delivery-type check from the script makes a test fail.
- `prune.py`, run against faked Cloudinary responses:
  - 45 backups over 45 days: it deleted the 15 older than 30 days;
  - 3 old backups: it deleted none.
- `shellcheck` is clean, and `./scripts/preflight.sh` passed in full.
- **Not yet done:** the live Cloudinary setup, the first backup and the restore drill.
