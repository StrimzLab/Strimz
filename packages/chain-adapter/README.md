# @strimz/chain-adapter

The chain-agnostic port. Every Strimz chain implementation (Base, Arc,
Stellar, …) conforms to the `ChainAdapter` interface defined here.

This package is **framework-free** — no NestJS, no Prisma, no viem.
Concrete adapters bring their own toolchain.

## Why ports + adapters

Strimz's business logic — sessions, subscriptions, refunds, webhooks,
admin platform — never references a specific chain. Chain-touching
operations (signing envelopes, relayer submission, indexer event
subscription) go through an adapter resolved at runtime from the
session's `chain` field.

Adding a new chain = ship one `ChainAdapter` implementation + register
it in the runtime registry. No changes to apps/api, apps/web,
apps/scheduler, or apps/agent.

## What's in the box

| File              | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `ports.ts`        | The `ChainAdapter` interface                                         |
| `capabilities.ts` | `ChainCapabilities` — declarative feature flags per chain            |
| `envelopes.ts`    | Opaque per-chain bundles that cross the adapter boundary             |
| `errors.ts`       | Typed errors (`ChainNotFoundError`, `AdapterNotImplementedError`, …) |
| `registry.ts`     | `ChainAdapterRegistry` — `register()` + `get()` + `list()`           |
| `types.ts`        | Shared primitives (`ChainId`, `ChainFamily`)                         |

## Consumers

- `@strimz/chain-adapter-evm` — Base + Arc (+ any other ERC-3009/2612 chain)
- `@strimz/chain-adapter-stellar` — Stellar pubnet + testnet (M5)
- `apps/api/src/infra/chain-registry` — Nest wrapper around the registry

## Stability

The port interface is the system's most important boundary. Changes here
ripple to every adapter. Treat it as load-bearing — add capabilities
behind optional methods first, promote to required only when every
adapter implements them.
