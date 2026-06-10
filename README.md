# Strimz

**Subscription billing for businesses that get paid in stablecoins.**

[![CI](https://img.shields.io/github/actions/workflow/status/StrimzLab/Strimz/ci.yml?branch=main&label=CI&logo=github)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](./.nvmrc)
[![Foundry](https://img.shields.io/badge/Foundry-Solidity-FFDB1C)](https://book.getfoundry.sh)
[![Arc](https://img.shields.io/badge/Chain-Arc-000000)](https://www.arc.network)

---

## What this is

Strimz is a billing platform for businesses that charge customers in
stablecoins. Subscriptions, one-shot payments, refunds, invoices. We
built it because the existing options are either "Stripe with no crypto
support" or "a wallet pretending to be a payments product." Neither one
is what a B2B finance team actually wants.

Settlement happens on Arc, Circle's stablecoin-native L1. Gas is paid in
USDC. A payment confirms in around 13 seconds. The merchant gets a webhook,
the customer gets a receipt, and the loop closes.

---

## Why we're building it

Every team that wants to charge customers in stablecoins discovers the
same thing about six weeks in: there's no Stripe for this. So they glue
together a relayer, a hosted checkout, a webhook delivery system, a
reconciler that turns chain events into customer records, and some kind of
dunning logic. Then they realise they also need cross-chain settlement for
the payers who happen to be on Base instead of Arc, and refunds for the
customer who pinged support last week, and KYB for the legal team. The
gas balance on the relayer wallet runs low at 3am on a Sunday.

A quarter goes by. The product they actually meant to ship hasn't moved.
Half of them give up and go back to invoicing customers and accepting a
wire.

Strimz is the thing they wished existed.

---

## What's in the box

Three product surfaces, plus the infrastructure to make them work.

**Hosted checkout.** Redirect the customer to a Strimz URL. They connect a
wallet, sign once (EIP-3009), and the relayer broadcasts the on-chain
transaction. The customer doesn't pay gas and doesn't confirm twice. The
merchant gets `payment.completed` over a signed webhook within seconds of
the transaction landing.

**Subscriptions.** Plans, intervals, grace periods, dunning. Enrolment is
one EIP-2612 permit signature; the scheduler does the rest, period after
period, using a deterministic charge ID that the contract refuses to
honour twice. No chargebacks — the chain doesn't have them. No
expired-card retries — there are no cards.

**The AutoPay Agent.** This one needs its own section; see below.

Around those: refunds, invoices, a storefront surface for merchants who
don't have a website yet, signed webhooks with retries and dead-letter, a
server SDK, a React SDK, and a merchant dashboard that doesn't make
finance people uncomfortable.

---

## A 30-second integration

Server-side, after issuing an `sk_test_` key in the dashboard:

```ts
import { Strimz } from '@strimz/sdk'

const strimz = new Strimz({ apiKey: process.env.STRIMZ_KEY! })

const session = await strimz.paymentSessions.create({
  amount: '50000000', // 50 USDC, 6 decimals
  currency: 'USDC',
  description: 'Pro plan, August',
  successUrl: 'https://your-site.com/thanks',
})

console.log(session.checkoutUrl)
```

Redirect the customer to `session.checkoutUrl` and wait for the webhook.
That's it. If you've integrated Stripe Checkout before, the surface area
is roughly the same — wallet step instead of card step.

---

## How it works

```
                         ┌──────────────────────────────────────────┐
                         │              Arc Blockchain              │
                         │   StrimzRegistry · Payments · Subs ·     │
                         │   FeeCollector · AgentRegistry · Escrow  │
                         └───────────┬───────────────────┬──────────┘
                                     │ events            │ tx
                                     ▼                   ▲
   ┌────────────┐   HTTP    ┌────────────┐  Redis  ┌────────────┐
   │  Merchant  │ ────────► │            │ stream  │            │
   │   web app  │           │ apps/api   │ ◄─────► │  scheduler │
   │  (Next.js) │ ◄──────── │  (NestJS)  │         │  (NestJS)  │
   └─────┬──────┘  webhooks │            │         │            │
         │                  └────┬───────┘         └────┬───────┘
         │ wallet                │ rw                   │ rw
         │ (viem/wagmi)          ▼                      ▼
         │                  ┌──────────────────────────────────┐
         │                  │     PostgreSQL 16 (Render)       │
         │                  │     (source of read state)       │
         │                  └──────────────────────────────────┘
         │                                ▲ rw
         │                                │
         │                  ┌────────────┐│
         │                  │  indexer   ├┘
         │                  │   (Go)     │
         │                  └─────┬──────┘
         │                        │ event subscribe (JSON-RPC)
         ▼                        ▼
   ┌────────────┐           ┌──────────────────────────────────┐
   │  payer's   │           │              Arc                 │
   │   wallet   │ ────────► │  (USDC gas, native EURC, USYC)   │
   └────────────┘           └──────────────────────────────────┘

                            ┌────────────┐
                            │   agent    │  Read-only. Drives recovery,
                            │  (NestJS)  │  cashflow, commerce, routing.
                            └────────────┘  Holds no signing key.
```

A few things to know about how this is wired up.

The contract is the source of truth for money. Postgres sits downstream,
rebuilt from event logs by a Go indexer. If we lose the database tomorrow,
we replay from genesis and converge. The merchant's view of the world is a
projection of the chain, not a separate ledger that could drift.

Subscription charges are addressed by a deterministic ID,
`keccak256(subscriptionId, periodEndAt)`, and the contract rejects repeats.
The "we accidentally double-charged because the cron retried" failure mode
isn't reachable. We didn't build that in the database layer; we built it
in Solidity, because billing systems should fail closed.

Only one process holds a signing key — the relayer inside `apps/api`. The
scheduler and the agent push jobs to the API when they want a transaction
broadcast; they sign nothing themselves. The key is KMS-backed in
production. A bug in the scheduler can corrupt scheduling, but it can't
move money. That separation was deliberate.

---

## Why Arc

A few reasons.

Gas in USDC means the relayer doesn't need an ETH balance. Treasury runs
on one asset. Cash-flow forecasting on the operator side gets simple.

13-second finality is good enough that the payer gets a confirmation
before they tab away from the page. Stripe-redirect feel. Conversion
holds up.

EURC and USYC are native on Arc. A merchant can hold revenue in
interest-bearing collateral (USYC is a tokenised treasury bill) without
bridging out, and can bill in EUR without picking up bridge risk. We've
debugged enough multi-chain stablecoin flows to value the absence.

Payers don't have to be on Arc. If they're on Ethereum, Base, Polygon, or
OP Mainnet, the bridge runs through Circle CCTP v2 — the agent watches for
the burn, polls Circle for the attestation, queues the Arc settle. From
the merchant's side it lands as USDC.

---

## The AutoPay Agent

Once a merchant turns it on, the agent handles seven separate things. Each
one is independently toggleable from the dashboard.

`recovery` — when a subscription enters `at_risk` because the customer
was short on funds, the agent emails them on a schedule the merchant
picks (`once`, `twice`, or `until_grace_ends`). It deduplicates so nobody
gets spammed.

`cashflow.digest` — every morning at 9am UTC, a one-screen email
summarising yesterday's revenue: gross, fees, net, transaction count,
unique customers. Nothing fancy. It's the email a merchant would have
written a script for in week three.

`cashflow.anomaly` — once an hour, the agent compares the last completed
clock-hour's revenue against the same hour-of-day over the trailing 30
days. If the current hour is far enough below baseline, the merchant gets
an email. Drops only. Nobody wants a ping for good news.

`cashflow.yield` — runs daily. If the merchant's balance is comfortably
above the reserve floor they configured, the agent flags the surplus and
suggests moving it into yield. The merchant signs the move. The agent
doesn't hold custody and isn't going to.

`commerce` — outbound payments to a merchant-approved vendor allowlist.
Below the merchant's threshold the agent auto-approves; above it, the job
sits in the dashboard until a human clicks approve. Monthly summary by
vendor.

`pricing_intelligence` — once a month: MRR, 12-month churn, and a 90-day
forecast from a linear regression over the last quarter. The numbers
we'd want to see ourselves if we ran a SaaS off Strimz, which we do.

`routing` — the CCTP bridge worker. Reads bridge jobs from a queue, polls
Circle's attestation API on a 30-second loop, queues the Arc settle action
when attestation completes.

Two trust properties that make this work for a finance team.

The agent holds no signing key. Anywhere. Every value-moving action it
appears to take is actually one of three things: an email, an entry in
the audit log, or a job queued for the relayer with the merchant's spend
cap and vendor allowlist attached. The merchant keeps custody.

Everything is configurable per merchant. Grace period, escalation cadence,
approval threshold, vendor allowlist, monthly spend cap, anomaly
sensitivity, reserve floor, yield strategy. It all sits in
`AgentMerchantConfig`. The agent's behaviour is the merchant's call, not
ours.

---

## Safety

A billing platform feels custodial even when it isn't. One bad day and
the relationship is over. We've taken that seriously.

- Subscription charges are idempotent in the contract. A retried charge
  for the same period is rejected on-chain, not by our database. The race
  condition can't exist.
- Three independent layers stop a payment session from being charged
  twice. The indexer stamps the session on confirmation; the API
  short-circuits a second relay submission; the checkout page polls
  status before showing the sign prompt. Any one would catch a duplicate.
  All three together make it impossible.
- Every value-moving function on every contract respects a single
  `Pausable` modifier. If something is wrong, transfers halt across the
  platform at once.
- Fees accrue in a separate `FeeCollector` contract that the treasury
  pulls from on a schedule. Pull, not push — less reentrancy surface,
  simpler accounting.
- Webhooks are HMAC-SHA256 signed over `t=<unix>,v1=<hex>`. The SDK
  verifies them. Signatures older than five minutes are rejected, so a
  leaked payload can't be replayed later.
- We hold no keys for anyone. Wallet addresses only. Every value-moving
  signature comes from the merchant's or the payer's own wallet.
- Mainnet deploy is gated on a third-party audit. Until that's done, this
  is testnet, and we're not pretending otherwise.
- Address screening at signup and at first payer interaction. Application
  to Circle Compliance Engine is in flight.

The longer writeup — indexer race-condition guards, the sweeper's
stale-lock reclaim, the dual-mode merchant auth guard — lives in the docs.

---

## Who it's for

The shortlist of who'll get the most out of Strimz right now.

SaaS companies billing customers in USDC. DePIN protocols. AI-infra
startups. On-chain SaaS. Any team where "we accept USDC" is a real
go-to-market line and not a footnote on the pricing page.

Stablecoin-native marketplaces and storefronts. The shape of the product
is checkout-and-webhooks, not custody.

Web3 protocols selling subscriptions to their dashboards or APIs. You
want a Stripe-shaped surface your existing tooling can integrate against.

Treasury teams paying suppliers. The `commerce` capability is built for
exactly this — programmable outbound payments with caps, allowlists, and
an audit trail.

What Strimz isn't: a wallet, a CEX, a custodial product, an L2. We're the
rails between the merchant and the payer. We don't hold funds. We don't
manage keys.

---

## Where we are

Live on Arc testnet (chain id `5042002`). Contracts deployed, indexer
running, dashboard live. End-to-end works — merchant signup, plan
creation, hosted checkout, subscription enrolment, recurring charge,
refund, webhook. We use it ourselves.

Shipped so far: the smart contract suite (Payments, Subscriptions,
Registry, FeeCollector, AgentRegistry, AgentEscrow), the Go indexer, the
BullMQ scheduler, the merchant dashboard, hosted checkout, the seven
AutoPay Agent capabilities, the server SDK, the React SDK, transactional
and operational email on the verified `mail.strimz.finance` domain,
gas-balance monitoring, audit logging.

What's next: the independent contract audit, Circle Compliance Engine
integration, the mainnet deploy, the public SDK release, the first
production merchants.

---

## Repo layout

Turborepo monorepo. Five apps — `web` (Next.js dashboard, checkout,
marketing), `api` (NestJS HTTP), `indexer` (Go), `scheduler` (NestJS
workers), `agent` (NestJS) — and a `packages/contracts` Foundry workspace.
Shared SDKs and brand UI live under `packages/`. Each app has its own
README with run instructions.

---

## Links

- Marketing: [strimz.finance](https://strimz.finance)
- Docs: going live alongside the public launch
- Email: strimztokenstream@gmail.com

---

## License

[MIT](./LICENSE) © 2026 Strimz.
