# Runbook: database backups and restore

Nightly encrypted backups of the mainnet `strimz` database go to Cloudinary (ADR-2026-11-23-nightly-backups, amended 2026-11-24). This page covers setup, checks and a real restore.

## Read this first: the private key

Every backup is encrypted to one `age` key pair. The server holds only the public key (`age1…`). The private key (`AGE-SECRET-KEY-1…`) lives in the founder's password manager and nowhere else. **If it is lost, no backup can be opened by anyone.** It is never pasted on the server, into a chat or into the repo.

## What is backed up

| What              | Backed up?                                          | Why                                                                                                                |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Postgres `strimz` | Yes, nightly at 02:00 UTC (03:00 WAT), kept 30 days | Source of truth off-chain                                                                                          |
| Redis             | No                                                  | Queues are rebuilt from Postgres by `webhook-recovery` and `subscription-sweeper`; the rest is caches and counters |
| On-chain state    | No                                                  | It lives on Arc; the indexer replays from the restored cursor                                                      |
| `.env.mainnet`    | No                                                  | Secrets; see the private ops manual                                                                                |

## One-time setup

1. **Key pair**, on your Mac:

   ```bash
   brew install age
   age-keygen -o ~/strimz-backup-key.txt
   ```

   - Save the whole file's contents in your password manager.
   - Delete the file: `rm ~/strimz-backup-key.txt`.
   - The `# public key: age1…` line is the public key; it's the only part the server gets.

2. **Cloudinary upload preset**, in the Cloudinary console:
   - Note the **cloud name** on the dashboard home.
   - Settings → Upload → **Upload presets** → Add upload preset:
     - **Upload preset name:** something hard to guess, e.g. `strimz-bk-` plus 12 random letters. It works like a password.
     - **Signing mode:** Unsigned.
     - **Asset folder:** `strimz-backups`.
     - **Delivery type** (under Optimize and Deliver, or Advanced): **Authenticated**, so backups have no public link.
   - Save it. Unsigned uploads can't overwrite or delete, so the server can only add backups.
3. **API key and secret** (Settings → API Keys): save them in your password manager. They're only for the monthly cleanup on your Mac. Never put them on the server.
4. **Healthchecks.io**:
   - Create a check with schedule **cron `0 2 * * *`**, time zone UTC, grace **2 hours**.
   - Keep its ping URL (`https://hc-ping.com/<uuid>`).
5. **Install on the server.** The repo on the server must be at a `main` that has this change:

   ```bash
   ssh -t ubuntu@<server> 'cd ~/strimz && git fetch && git merge --ff-only origin/main && sudo bash infra/backup/install.sh'
   ```

   - It installs `age`.
   - It asks for the public key and cloud name, then for the preset name and ping URL through hidden prompts, and writes them to `/etc/strimz-backup.env` (root, mode 600).
   - It installs the script and the timer.
   - Run it again with `--reconfigure` to change the values.

6. **First run:**
   - `sudo systemctl start strimz-backup.service && journalctl -u strimz-backup -n 20 --no-pager`;
   - the check on Healthchecks.io should turn green.

## Day to day

Nothing. Healthchecks.io emails if a night's backup fails or doesn't arrive.

- Next run: `systemctl list-timers strimz-backup.timer`.
- Last runs: `journalctl -u strimz-backup --since -3d --no-pager`.
- A failed run uploads nothing.
- A run also fails if Cloudinary stored the backup without **Authenticated** delivery. Fix the preset; the encrypted file it left can be deleted from the console.
- **Monthly cleanup**, on your Mac, deletes backups older than 30 days but always keeps the newest 7:

  ```bash
  /usr/bin/python3 infra/backup/prune.py <cloud name>           # lists what it would delete
  /usr/bin/python3 infra/backup/prune.py <cloud name> --delete  # deletes it
  ```

  It asks for the API key and secret with hidden prompts. Missing a month only keeps more encrypted copies.

- If the preset name ever leaks: create a new preset, rerun `sudo bash infra/backup/install.sh --reconfigure`, and delete the old preset.
- Upgrading the script after a change in `infra/backup/`: rerun `sudo bash infra/backup/install.sh`. A `git pull` alone doesn't change what root runs.

## Check a backup (restore drill)

Do this once after setup, and then each quarter or after a large schema change. It runs on your Mac, with Docker running, and the server is untouched.

1. Download the newest backup from the Cloudinary console: Media Library → `strimz-backups` → the newest `strimz-<timestamp>.dump.age` → Download.
2. Put the private key from your password manager in a temporary file (`~/k.txt`).
3. Run:
   ```bash
   bash infra/backup/verify-restore.sh ~/Downloads/strimz-<timestamp>.dump.age ~/k.txt
   rm ~/k.txt
   ```
   This restores into a throwaway `postgres:16` container, prints each table's row count, and removes the container. The decrypted dump only passes through a pipe.
4. Compare with the live counts:
   ```bash
   ssh ubuntu@<server> 'sudo docker exec -i -u postgres strimz psql -At -F " " strimz' < infra/backup/row-counts.sql
   ```
   Tables that only grow should be equal or a little larger on the server, by whatever changed since the backup.
5. Record the date and result in **Drill log** below.

## Real restore onto the server

Only after deciding the live database is lost or corrupt.

1. **Stop the writers**, and keep Postgres, Redis and nginx up:
   ```bash
   sudo docker exec strimz supervisorctl stop api scheduler agent indexer
   ```
2. **Restore into a new database**, streamed from your Mac over SSH, so the plaintext never lands on disk:
   ```bash
   ssh ubuntu@<server> 'sudo docker exec -u postgres strimz createdb strimz_restore'
   age -d -i ~/k.txt ~/Downloads/strimz-<timestamp>.dump.age \
     | ssh ubuntu@<server> 'sudo docker exec -i -u postgres strimz pg_restore -d strimz_restore --no-owner --exit-on-error'
   rm ~/k.txt
   ```
3. **Swap it in**, keeping the old one for later inspection:
   ```bash
   ssh ubuntu@<server> 'sudo docker exec -u postgres strimz psql -c "ALTER DATABASE strimz RENAME TO strimz_broken" -c "ALTER DATABASE strimz_restore RENAME TO strimz"'
   ```
4. **Start the writers:**
   ```bash
   sudo docker exec strimz supervisorctl start api scheduler agent indexer
   ```
   Then `sudo docker exec strimz supervisorctl status` should show `api`, `scheduler` and `indexer` as `RUNNING`.
5. **Check:**
   - The indexer catches up from the restored cursor (`IndexerCursor.lastProcessedBlock` rising in its logs).
   - Payments made since the backup reappear.
   - Its projections are upserts on `(txHash, logIndex)`, so the replay doesn't duplicate rows.
   - Off-chain changes since the backup (new API keys, settings, webhook endpoints, unpaid payment sessions) are gone; tell affected merchants.
6. Once everything is confirmed: `dropdb strimz_broken`.

If the whole server is gone, rebuild the container on a new host first (`docs/runbooks/mainnet-deploy.md`). Its first boot creates an empty `strimz` database; then follow steps 1–6 as written.

## Drill log

| Date (UTC) | Backup | Result |
| ---------- | ------ | ------ |
