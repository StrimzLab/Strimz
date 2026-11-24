# Nightly database backups (plain English)

Issue #493. Technical version: ADR-2026-11-23-nightly-backups.

## The problem

All of Strimz's records sit on one disk in one OVH server: merchants, API keys, subscriptions, webhooks and admin records. If that disk dies, they're gone. The money itself is safe on the blockchain, but the records around it aren't.

## What we'll do

- **Every night at 03:00 WAT**, the server copies the whole database.
- **It locks the copy** with a key only you hold. The server gets the "lock" half; the "unlock" half lives in your password manager. A hacker on the server can't read a backup.
- **It sends the copy to Cloudflare R2**, away from OVH.
- **R2 keeps each copy for 14 days** and won't let anyone delete it sooner, even with the server's password. Then it deletes it automatically.
- **If a night's backup doesn't arrive, Healthchecks.io emails you.** That includes the server being down.
- **A step-by-step restore guide**, tested once for real before we call this done.

## What you'll need to do (about 15 minutes, once)

1. Make the key pair on your Mac (one command), save the private half in your password manager, and send me only the public half.
2. Create an R2 bucket, its lock and its cleanup rule (I'll give you the exact clicks or commands), plus a token for that bucket only. You'll paste the token on the server through a hidden prompt.
3. Make a free Healthchecks.io check and paste its ping link the same way.

## The trade-offs

- **Up to a day of off-blockchain changes could be lost** after a disaster, for example an API key made that afternoon. Payments aren't lost: Strimz re-reads them from the blockchain.
- **If you lose the private key, the backups can't be opened by anyone.** Keep it safe.
- **Cost:** free at today's size.

## Change (24 November 2026): Cloudinary instead of Cloudflare R2

R2 wanted a payment card, so the backups go to Cloudinary's free plan instead.

- **Same as before:** the backups are locked with your key before they leave the server, and Healthchecks.io still emails you if a night is missed.
- **Nobody can wipe them:** the server can add new backups, but it can't delete or replace old ones. Only someone with your Cloudinary password or API secret can.
- **New monthly job:** Cloudinary doesn't delete old files by itself. Once a month you run one command on your Mac to delete backups older than 30 days. If you forget, nothing breaks; you just keep a few more locked copies.
- **One limit:** a single file on the free plan has a size cap (about 10 MB). Ours is about 0.15 MB, so there's plenty of room. If we ever outgrow it, the backup fails loudly and we change plans.
