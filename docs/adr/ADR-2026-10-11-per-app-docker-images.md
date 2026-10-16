# ADR: Per-app Docker images that start, a smoke test in CI, and a working compose stack

- **Status:** Accepted (2026-10-11, D1–D5 as recommended)
- **Date:** 2026-10-11
- **Scope:**
  - `apps/api`, `apps/scheduler`, `apps/agent`: Dockerfiles; the scheduler and the
    agent build only `src/` so their entry is `dist/main.js`.
  - `Dockerfile.lightsail` and `infra/lightsail/supervisord.conf`: the new entry paths.
  - `.github/workflows/docker.yml`: start each image and check it gets as far as env
    validation.
  - `docker-compose.yml` (`full` profile and `anvil`), `apps/scheduler/.env.example`.
- **Not in scope:** no TypeScript source change, no Solidity, no migration, no published
  package. The indexer image already works.

## Context

Issue #144, checked on 2026-10-11 against `main` at `0efff34`.

1. **None of the three Node images starts.** Built from `main` and run with no env:

   | Image     | Result                                                                                         |
   | --------- | ---------------------------------------------------------------------------------------------- |
   | api       | `ERR_MODULE_NOT_FOUND: Cannot find package 'reflect-metadata' imported from /app/dist/main.js` |
   | scheduler | `Cannot find module '/app/dist/main.js'`                                                       |
   | agent     | `Cannot find module '/app/dist/main.js'`                                                       |
   - The runtime stage copies `apps/<app>/node_modules`. The workspace uses
     `node-linker=isolated`, so those entries are symlinks into `/repo/node_modules/.pnpm`,
     which is not copied. Every dependency import fails.
   - The scheduler and the agent compile with `rootDir: "."` and include `test/`, so the
     entry is `dist/src/main.js`. Their Dockerfiles and `start` / `start:prod` scripts
     run `dist/main.js`. The API uses a `tsconfig.build.json` with `rootDir: "src"` and
     gets `dist/main.js`.

2. **CI does not notice.** `.github/workflows/docker.yml` only builds the images
   (`push: false, load: false`). A build that assembles a non-starting image passes.
3. **Production is not affected.** Lightsail runs `Dockerfile.lightsail`, which copies
   the whole built workspace and starts the scheduler and the agent from
   `dist/src/main.js` (`infra/lightsail/supervisord.conf:76,93`).
4. **The compose `full` profile cannot run the stack.**
   - The indexer gets `?schema=public` in `DATABASE_URL`. Its pgx driver rejects that
     parameter; Lightsail passes the indexer its own URL with `sslmode=disable`
     (`supervisord.conf:108-111`).
   - The API, the scheduler and the agent run with `NODE_ENV=production`. Production
     now refuses the software signer (#137), refuses a missing `TURNSTILE_SECRET_KEY`
     (#133) and checks the RPC's chain id (#138). Compose is a local stack with no KMS
     and no Turnstile.
   - `ARC_ENVIRONMENT=testnet` points at `anvil` on chain 31337, while shared-config's
     testnet is 5042002. The scheduler signs for 5042002 and anvil rejects it.
5. **Env examples.** `apps/scheduler/.env.example` lacks `RELAYER_ADDRESS` and
   `STRIMZ_ADMIN_ALERT_EMAIL`, both required by the scheduler schema, so a copy of the
   example does not boot. The Lightsail items in the issue (`STABLECOIN_ADDRESSES`, the
   admin email, the relayer address) were already fixed on `main`.

### Red, failing on `main` at `0efff34`

- A smoke script, `scripts/docker-smoke.sh <image>`, runs the image with no env and
  passes only when the output contains `Invalid environment configuration` (the app
  loaded its code and reached env validation) and no module-resolution error. On the
  three images above it fails for the reasons in the table.
- `docker compose --profile full config` and a boot of the profile: the indexer exits
  on its database URL and the API refuses the software signer.

## Decision

1. **Image layout (D1).** The build stage runs
   `pnpm --filter @strimz/<app> deploy --prod --legacy /out` after the build. The
   runtime stage copies `/out`, which holds a real, pruned `node_modules`, the app's
   `dist/` and its workspace packages per their `files` fields. Prisma 7 runs on
   `@prisma/adapter-pg` with no native engine, so nothing else is needed.
2. **One entry path (D2).** The scheduler and the agent get a `tsconfig.build.json` like
   the API's (`rootDir: "src"`, `include: ["src/**/*"]`), and `nest-cli.json` points at
   it. Their entry becomes `dist/main.js`, which the Dockerfiles and the `start`
   scripts already use. `infra/lightsail/supervisord.conf` moves to `dist/main.js` in
   the same PR, so the production image keeps starting.
3. **Smoke test in CI (D3).** `docker.yml` loads each Node image and runs
   `scripts/docker-smoke.sh` on it. The workflow also triggers on changes to
   `Dockerfile.lightsail`, `infra/lightsail/**`, the apps' `tsconfig.build.json` and
   `nest-cli.json`, and builds and smoke-tests the Lightsail image.
4. **Compose `full` is a local stack (D4).**
   - `NODE_ENV=development` for the API, the scheduler and the agent: the software
     signer, no Turnstile, no boot chain check, as in `pnpm dev`.
   - `anvil` runs with `--chain-id=5042002`, so the local chain matches shared-config's
     testnet and signatures are accepted. The indexer's `ARC_CHAIN_ID` follows.
   - The indexer gets `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/strimz?sslmode=disable`.
   - Found during the build: the `anvil` healthcheck calls `wget`, which the current
     foundry image no longer ships, so `anvil` never turns healthy and the indexer never
     starts, in either profile. The check becomes `cast block-number`, which the image
     ships.
5. **Env examples (D5).** `apps/scheduler/.env.example` gains `RELAYER_ADDRESS` and
   `STRIMZ_ADMIN_ALERT_EMAIL`.

## Diagram

```mermaid
flowchart LR
  subgraph build[build stage]
    I[pnpm install] --> B[turbo build app + deps]
    B --> D["pnpm deploy --prod --legacy /out"]
  end
  subgraph runtime[runtime stage]
    O["/app = /out: dist/main.js + real node_modules"]
  end
  D --> O
  O --> S{"docker-smoke.sh: run with no env"}
  S -->|"Invalid environment configuration"| P[pass]
  S -->|"module not found / no output"| F[fail CI]
```

## Consequences

- The per-app images start, and CI fails when one stops starting.
- The images carry production dependencies only, with no store and no sources. They are
  larger than the images on `main` (about 800 to 900 MB against 240 MB), because those
  held broken links instead of the dependencies.
- The Lightsail image changes one path per service. A mistake there would stop
  production, so the Lightsail image joins the smoke test.
- The `full` profile no longer exercises production settings. Production checks are
  covered by unit tests and by the Lightsail deploy.
- Local contract deploys against compose `anvil` see chain 5042002. Anyone who saved
  31337 locally re-adds the chain. The indexer's own end-to-end tests start their own
  anvil and are unaffected.
- The docker workflow takes longer when it runs, because it loads images and builds the
  Lightsail image. It still only runs when Docker-related files change.

## Alternatives

- **Copy the whole `/repo` into each runtime image, as Lightsail does.** Simpler but
  ships the store, sources and dev dependencies.
- **Run `dist/src/main.js` in the Dockerfiles and the `start` scripts.** Keeps `test/` in
  `dist/` and leaves the scheduler and the agent different from the API.
- **Delete the per-app images and the `full` profile.** Nothing deploys them today, but
  they are the route off the single Lightsail container.
- **Keep `NODE_ENV=production` in compose and feed it KMS and Turnstile settings.** Not
  possible locally without AWS.

## Decisions for the maintainer

- **D1. Image layout.** Recommended: `pnpm deploy --prod --legacy`. Alternatives: copy
  the whole workspace; delete the per-app images.
- **D2. Entry path.** Recommended: `tsconfig.build.json` for the scheduler and the agent,
  entry `dist/main.js` everywhere, Lightsail updated in the same PR. Alternative: run
  `dist/src/main.js`.
- **D3. CI smoke test.** Recommended: smoke-test the three Node images and the Lightsail
  image. Alternative: the three per-app images only.
- **D4. Compose.** Recommended: `NODE_ENV=development`, anvil on 5042002, the indexer's
  own database URL. Alternative: anvil stays on 31337 and compose uses a local chain
  setting (needs a third `ARC_ENVIRONMENT`).
- **D5. Env examples.** Recommended: add the two scheduler variables.

## Migration, versioning, docs

- No changeset; no published package changes.
- Lightsail: the next redeploy builds the new paths. No `.env` change.
- Comments that become false (for example the compose header's anvil chain id line and
  the `NODE_ENV` note on the API service) are listed in the PR for a human to correct
  (Directive 6).
- Release note.

## Verification

- `scripts/docker-smoke.sh` fails on the three images from `main` and passes on the new
  ones, plus the Lightsail image.
- `docker compose --profile full up` after `pnpm db:migrate`: all four app containers
  stay up and their health endpoints answer.
- `./scripts/preflight.sh` in full.
