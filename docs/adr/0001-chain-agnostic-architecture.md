# 0001 — Chain-agnostic architecture

**Status:** accepted
**Date:** 2026-06-16
**Owners:** Strimz core team

## Context

Strimz started as an Arc-only stablecoin billing platform. With Arc still on
testnet and our audit-gated launch needing a production-ready settlement chain,
the team is moving the v1 launch to Base. At the same time we are committing to
Stellar as the second supported chain — distinct from EVM at the primitive
level (no EIP-3009, no permits, expiring SEP-41 approvals, two-stream indexing)
but identical at the business level (charge a customer, settle a payment,
enrol a subscription).

We need an architecture that:

1. Lets the SDK and merchant integration stay chain-agnostic. An integrator
   never picks a chain in code.
2. Lets the customer pick a chain at checkout. The session is multi-chain by
   default; the chain is decided at sign time.
3. Lets us add chains (Solana, future EVMs, future non-EVMs) by writing one
   adapter, not by branching service code.
4. Lets us absorb the running Base work without rebuilding everything else.

## Decision

We adopt a **ports-and-adapters** (hexagonal) architecture with the abstraction
boundary at the **business operation layer** — `preparePayment`, `chargeSubscription`,
`refund`, `subscribeEvents` — never at the chain primitive layer (token transfer,
signature shape, RPC call).

### What's chain-agnostic

- Merchant, AdminUser, ApiKey, Webhook, AuditLog, Customer, Invoice
- PaymentSession, Subscription, SubscriptionPlan, Refund, Transaction
  (business state machine and projections; columns gain a `chain` field where
  relevant)
- Agent capabilities (recovery, cashflow, commerce, pricing)
- Dashboard, admin platform, emails, webhooks
- The SDK (no chain field in any public method)

### What's chain-specific

- Signing flow + envelope shape (EIP-712 vs Stellar XDR)
- Address validation + width (42-char hex vs 56-char Strkey)
- Relayer / KMS curve (secp256k1 vs Ed25519)
- Indexer subscription (eth_subscribe vs Horizon SSE + Stellar RPC getEvents)
- Approval lifecycle (EVM: indefinite via EIP-2612; Stellar: explicit
  `live_until_ledger`)
- Wallet picker on the checkout (wagmi + Reown vs `stellar-wallets-kit`)
- Smart contracts (Solidity vs Soroban / Rust)

### Package layout

```
packages/
  chain-adapter/           ports (interfaces), capabilities, registry
  chain-adapter-evm/       Base + Arc + future EVM chains
  chain-adapter-stellar/   Stellar pubnet + testnet
  contracts/               Foundry workspace (EVM)
  contracts-stellar/       Soroban / Rust workspace (Stellar)
```

`apps/api`, `apps/web`, `apps/scheduler`, `apps/agent` depend on `chain-adapter`
(the port) only — never on a concrete adapter package. The runtime registry
resolves a `ChainId` to the right adapter at request time.

### Chain identifier scheme

We use a `family:network` string, e.g. `evm:base`, `evm:arc`, `stellar:pubnet`,
`stellar:testnet`. This is stable across the codebase — Prisma columns, SDK
payloads, webhook events, audit logs. EVM numeric chain ids live inside the
adapter, not in the public identifier.

### Session model

A payment session is multi-chain at creation. The merchant doesn't choose; the
payer does:

```
PaymentSession.acceptedChains  string[]   // derived from merchant onboarding
PaymentSession.settledOn       string?    // populated when the on-chain confirm lands
PaymentSession.payerAddress    string?    // populated at chain-pick time
```

A subscription **plan** is chain-agnostic. A subscription **enrolment** is
chain-locked, because the on-chain contract instance lives on one chain.

### Onboarding model

A merchant supplies a payout address per chain they want to accept. Default
flow uses embedded wallets (Privy for EVM — already in production — and a
Stellar passkey smart wallet via `@passkey-ui/react`). Sophisticated merchants
can paste an existing wallet address as override. Strimz sponsors Stellar
account reserves and USDC trustlines for merchants who use the embedded
flow — cost is ~$0.15 per merchant; negligible at scale.

### Indexer split

The existing Go indexer (`apps/indexer`) keeps doing EVM. A new TypeScript
service (`apps/indexer-stellar`) handles Stellar's two streams:

- Horizon for classic operations (payments, fee-bumps, trustlines)
- Stellar RPC for Soroban contract events

Both publish to the same Redis stream the scheduler and agent already consume.
The 24-hour event retention on Stellar RPC is a hard ops constraint — the
ingester must keep up or it loses events; cursor monitoring + paging is part
of the indexer's first PR.

### Allowance lifecycle

Stellar's SEP-41 `approve(..., live_until_ledger)` is a non-negotiable hard
expiry. The scheduler grows a new lane:

- 14 days before expiry → email payer + merchant ("re-authorise to keep your
  subscription active")
- At expiry → subscription flips to `at_risk` immediately

`OnchainAllowance` is a new table that drives the cron.

## Alternatives considered

**Per-chain forks (no shared abstraction).** Rejected. Bug fixes diverge; the
agent, emails, admin platform, and webhooks would be duplicated three times.

**Per-chain modules inside `apps/api` (no shared package).** Rejected. Every
business service ends up with `if (chain === 'evm') ... else ...` branches.
Stripe doesn't do this.

**Bridge-everything to one chain (use a CCTP-style bridge to route Stellar
funds back to EVM).** Rejected. Bridges introduce settlement risk that a B2B
finance team will refuse to absorb, and the failure mode is "funds lost at a
bridge hop." Native settlement on the customer's chosen chain is the only
acceptable answer.

## Consequences

**Positive.**

- Adding new chains in the future is one adapter — no API/SDK/dashboard
  changes.
- The merchant integration never changes shape. An SDK call from 2026 still
  works in 2028.
- Each adapter can use the right tools for its chain (viem on EVM, Stellar
  SDK on Stellar) without leaking those into the rest of the codebase.

**Negative — accept and mitigate.**

- The Stellar indexer is a new service we own (mitigation: small, single-purpose,
  TypeScript-Nest like `apps/scheduler`).
- Allowance expiry adds a new dunning lane (mitigation: piggybacks on the
  existing notification cron + email template machinery).
- The chain-agnostic refactor is a load-bearing change before any Stellar code
  lands (mitigation: phased migration, M1 + M2 land EVM-only with no behaviour
  change, then Stellar layers on top).

## Implementation roadmap

See [implementation-plan-stellar-multichain.md](./implementation-plan-stellar-multichain.md)
for the milestone-by-milestone breakdown. Headlines:

- M1 — Schema + chain registry (additive; no behaviour change)
- M2 — Chain adapter port + EVM adapter (behaviour-preserving refactor)
- M3 — Stellar onboarding (passkey wallet integration)
- M4 — Soroban contracts (subscription + fee collector)
- M5 — Stellar adapter + indexer
- M6 — Frontend chain picker + Stellar checkout
- M7 — Whisk integration for cross-chain EVM routing (after whisk mainnet)
- M8 — Trustline onboarder for classic-account payers (optional v1.1)
