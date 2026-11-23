---
date: 2026-11-23
feature: Fanline demo references removed from the docs
scope: chore
scenario-impact: none
---

# Fanline demo references removed

The Fanline demo was for testnet testing only. Its Worker (`strimz-fanline`, `fanline.strimz.finance`) was deleted ahead of the mainnet launch, so the links to it were dead.

## What changed

- **README:** the "Live demo" section and link are gone.
- **Public docs:** the Fanline mentions are removed from the docs home ("See it running"), the quickstart's next steps, the React SDK page and the plans page.
- **`docs/runbooks/cloudflare-workers.md`:** the `strimz-fanline` Worker row, its size, its variables and the local port are gone.

## Not changed

- **The app code in `apps/demo-merchant`** stays, with its tests and the smoke and size scripts, for local testing.
- **ADRs and older release notes** are left as the historical record.
