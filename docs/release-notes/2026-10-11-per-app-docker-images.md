---
date: 2026-10-11
feature: The per-app API, scheduler and agent images start, CI starts every image before passing it, and the compose full stack runs
scope: fix
scenario-impact: none
---

# Per-app Docker images that start

None of the per-app Node images on `main` (`0efff34`) could start:

- **api:** `Cannot find package 'reflect-metadata'`. The image copied pnpm's symlinked
  `node_modules` without the store they point into.
- **scheduler and agent:** `Cannot find module '/app/dist/main.js'`. They built to
  `dist/src/main.js`.

CI only built the images, so it never noticed. The compose `full` profile could not run
either. The Lightsail image, which is what production runs, was not affected.

Fixes #144. ADR:
[ADR-2026-10-11-per-app-docker-images](../adr/ADR-2026-10-11-per-app-docker-images.md)
([plain-English version](../adr/ADR-2026-10-11-per-app-docker-images-for-dummies.md)), D1
to D5 as recommended.

## What shipped

- **Images.** Each Node Dockerfile runs `pnpm --filter @strimz/<app> deploy --prod --legacy /out`
  and ships its real, production-only `node_modules` with `dist/`.
- **One entry path.**
  - The scheduler and the agent build from a new `tsconfig.build.json` that compiles only
    `src/`, like the API, so every service starts from `dist/main.js`.
  - `infra/lightsail/supervisord.conf` starts them from `dist/main.js`.
- **Smoke test.** `scripts/docker-smoke.sh` starts an image with no env. It passes only
  when the app reaches `Invalid environment configuration`, and fails on any module
  resolution error. `.github/workflows/docker.yml` loads and smoke-tests the three Node
  images, and each service inside the Lightsail image. It now also runs on changes to
  `Dockerfile.lightsail`, `infra/lightsail/**` and the apps' build configs.
- **Compose.**
  - The `full` profile runs the services with `NODE_ENV=development`.
  - `anvil` runs on chain id `5042002`, shared-config's testnet.
  - The indexer gets a database URL pgx accepts (`?sslmode=disable`).
  - The `anvil` healthcheck uses `cast block-number`. It called `wget`, which the
    foundry image no longer ships, so `anvil` never turned healthy in either profile.
- **Env example.** `apps/scheduler/.env.example` lists `RELAYER_ADDRESS` and
  `STRIMZ_ADMIN_ALERT_EMAIL`.

## Operator steps

- **Lightsail:** nothing to set. The next redeploy builds the new entry paths;
  `Dockerfile.lightsail` itself is unchanged.
- **Local:** an `anvil` with saved state from chain 31337 starts fresh on 5042002.
  Re-add the local chain to wallets if needed.

## Verification

- `scripts/docker-smoke.sh` on the three images built from `main`: all fail for the
  reasons above.
- On this branch it passes for the three images, and for `api`, `scheduler` and `agent`
  each started inside the Lightsail image (`/repo/apps/<app>`, `node dist/main.js`).
- Image sizes: api 913 MB, scheduler 834 MB, agent 794 MB. The `main` images were about
  240 MB only because their `node_modules` held broken links.
- `docker compose --profile full` was run in an isolated project after
  `prisma migrate deploy`, with dummy `.env` files. All seven containers ran, `anvil`
  was healthy on chain id 5042002, and the health endpoints answered 200 (API
  `/health`, scheduler, agent and indexer `/healthz`).
- `./scripts/preflight.sh` in full.
