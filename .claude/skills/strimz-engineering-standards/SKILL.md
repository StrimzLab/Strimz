---
name: strimz-engineering-standards
description: Engineering standards for Strimz, the stablecoin subscription billing gateway on Arc. Read before writing or reviewing any code, comment, contract, migration, or document in this repository.
---

# Strimz Engineering Standards

These rules apply to every contributor, human or agent. They are not suggestions.
`AGENTS.md` holds the governance directives and lifecycle; this file holds the craft.

## Architecture

pnpm + Turborepo monorepo, TypeScript everywhere except the Go indexer and the Solidity
contracts. Launch target is Arc testnet (chain id 5042002), then Arc mainnet (5042).

### Layers

```
apps/        web  demo-merchant  api  scheduler  agent  indexer (Go)
               \       |          |       |        |       |
packages/     ui  sdk-react -> sdk   db   email-templates   |
                         \      |     |                     |
               shared-types  shared-crypto                  |
                         \      |                           |
                        shared-config                       |
                                                            |
packages/contracts (Solidity, Foundry) <--- ABIs copied ----+ (and into api relay)
```

- Every import points downward. Apps depend on packages; packages never import apps.
- Apps never import other apps. They talk only through the contracts listed below.
- `shared-config` is the leaf: chains, tokens, CCTP, tiers, webhook constants. It
  imports no other internal package.
- `shared-crypto` and `shared-types` may import `shared-config` and nothing else.
- `sdk` and `sdk-react` are published to npm. They may import the three `shared-*`
  packages, never `db`, `ui`, or an app.
- `db` owns the Prisma schema and migrations. It is the only place the schema changes.
- Inside NestJS apps: `modules/<domain>` (controller -> service) depend on `infra/*`
  and `common/*`; `infra` never imports a module; modules do not import each other's
  services except through an exported Nest provider.
- Inside `apps/web`: `app/` routes compose `components/`, which use `hooks/`, which
  use `lib/`. `lib/` and `hooks/` never import from `app/` or `components/`.
  Presentational components never fetch or hold a base URL.
- Layering is not yet lint-enforced. Reviewers check it against this section.

### Cross-service contracts (change producer and consumer together)

| Contract                           | Producer                 | Consumer                                                                         | Single source                         |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------- | ------------------------------------- |
| Contract ABIs and event signatures | `packages/contracts`     | `apps/indexer/internal/abi`, `apps/api/src/modules/relay/abi.ts`, scheduler, web | the Solidity source                   |
| BullMQ job payloads                | api, agent               | scheduler workers                                                                | one zod schema imported by both sides |
| Database tables                    | Prisma migrations        | api, scheduler, agent via Prisma; indexer via raw SQL                            | `packages/db/prisma/schema`           |
| Webhook events                     | indexer outbox rows, api | scheduler dispatcher, merchants via `@strimz/sdk`                                | `@strimz/shared-types`                |
| Public API                         | api                      | web, sdk, merchants                                                              | `@strimz/shared-types`                |

A change on one side of a row without the other is a production incident waiting for
traffic. The indexer writes Prisma tables with hand-written SQL, so every migration is
checked against `apps/indexer/internal/store`.

## Correctness

- Verify each implementation before moving to the next. Do not stack unverified work.
- No shortcuts: no `@ts-ignore`, no `any`, no swallowed rejection, no hardcoded value
  that hides the real path.
- No damage control: find the cause and fix it, never the symptom.
- Handle errors where they happen and surface them to the user in a useful state.
- Strict typing stays on in TypeScript; `go vet` stays clean; Solidity compiles with
  no new warnings.
- Tests prove behaviour: happy path, validation failure, error state, loading state.
- Money is integer base units end to end. Never use `number` or `float64` for an
  amount. Carry the currency and decimals with it.
- Anything a payer or merchant signs (EIP-712 domain and types) is defined once and
  tested against the contract's typehash.
- Chain and address configuration comes from `@strimz/shared-config` or validated env.
  Missing configuration fails at boot; it never falls back to testnet values.

## Contracts

- Foundry, solc 0.8.28, OpenZeppelin 5.x (upgradeable where the contract is UUPS).
- Every state-changing function has a test for its access control, its revert paths,
  and its events. Money-moving contracts keep invariant tests.
- A contract change ships with the matching ABI update in the indexer and api, a
  deployment plan in the ADR, and an updated `deployments/<chainId>.json` after deploy.
- Deployed addresses live in `packages/contracts/deployments/` and env files, and the
  README table is updated in the same PR as a redeploy.

## Frontend

- Next.js App Router, Tailwind, shadcn primitives from `@strimz/ui`.
- Every surface ships a user-visible light/dark toggle. No hard-coded light colours;
  use theme tokens.
- Every form input uses `FieldLabel` and is marked `(required) *` with a red asterisk
  or `(optional)`.
- Every async action has a loading state and a visible error state.

## Comments and naming

- Write every comment by hand, in plain English. Short, clear, specific.
- Default to no comment. A comment explains why, or a non-obvious what.
- No AI tone, no filler. Do not use em-dashes; use a comma, colon, or period.
- Name things for what they are.

## Documentation

- Technically correct, unambiguous, jargon defined on first use, examples runnable.
- Docs under `apps/web/content/docs` describe what the code does today. A feature on
  the roadmap is labelled as such. Code samples compile against the published SDK.

## Git and review

- One issue, one branch, one pull request. Branch prefixes: `feat/`, `fix/`, `chore/`,
  `docs/`.
- Never push to `main`. Squash merges only. Branch deleted on merge.
- Commits are atomic, in Conventional Commit form (`fix(indexer): ...`), with a
  message that says what changed and why.
- Never add AI co-author trailers or session footers to commits or PRs.
- Never commit or push on a contributor's behalf without being asked. Agents prepare a
  gitignored `ship-<topic>.sh` at the repository root that commits with
  `git commit -F - <<'MSG'`, pushes, and opens the PR with `--body-file`, guarded by
  `gh pr list --head <branch> --state open` so a re-run only pushes.
- Do not commit secrets. `.env` files stay out of git; only `*.env.example` files are
  tracked.

## Tooling

- pnpm only (version pinned in `packageManager`). Never run `npm install` or commit a
  `package-lock.json`.
- Node per `.nvmrc`, Go per `apps/indexer/go.mod`, Foundry stable.
- Git hooks are managed by lefthook (`lefthook.yml`), installed by `pnpm install`.
  Pre-commit formats staged files; pre-push runs `./scripts/preflight.sh --fast`.
- Run the preflight before opening a pull request. CI runs the same gates.
- When a task needs a library, read its current docs first; do not code from memory.
  This repo runs Next.js 15, React 19, Tailwind 4, Prisma 7, NestJS 11, viem 2, and
  Privy; several of these changed APIs recently.
