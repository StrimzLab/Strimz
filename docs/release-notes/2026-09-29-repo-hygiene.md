---
date: 2026-09-29
feature: Repo hygiene after #100 (lockfile, Docker build context, changeset)
scope: chore
scenario-impact: none
---

# Repo hygiene after #100

Nothing user-facing changed. Docker images built on a developer machine no longer
contain that machine's `.env` files.

Closes #107.

## What shipped

- Root `.dockerignore` and `apps/indexer/.dockerignore`. Local `.env` files,
  `node_modules`, build output, and Foundry dependencies stay out of the build context.
  `.env.example` files are still included.
- The root `package-lock.json` added by accident in #100 is removed, and
  `package-lock.json` is gitignored everywhere. The repo uses pnpm only.
- `apps/demo-merchant/.gitignore` no longer ignores its own `.env.example`.
- A changeset documents the `SubscriptionChargeOutcome` and `AgentJobStatus` values
  that #100 added.

## Why the Docker change matters

`Dockerfile.lightsail` copies `apps/api`, `apps/scheduler`, `apps/agent` and `packages`
whole, then copies the entire build stage into the runtime image. Without an ignore
file, every `.env` under those folders ended up in the final image.

| Measure                     | Before | After |
| --------------------------- | ------ | ----- |
| `.env` files in the context | yes    | none  |
| Root build context          | 2.8 GB | 12 MB |

The production deploy is not affected. `infra/lightsail/deploy.sh` builds from a clean
clone on the server and passes secrets with `--env-file`, and CI never pushes an image.

## Note on the changeset

The enum values from #100 first reached npm in `@strimz/shared-types` 0.3.1, whose
changelog did not mention them. The changeset here releases 0.3.2 with the same code
and the missing changelog entry.

## Maintainer follow-up

Any image built from `Dockerfile.lightsail` on a developer machine before this change
holds that machine's `.env` files. Delete those images:

```bash
docker rmi strimz:latest
```
