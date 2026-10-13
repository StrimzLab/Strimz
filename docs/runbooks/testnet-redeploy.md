# Runbook: redeploy the contracts on Arc testnet

Background: [ADR-2026-10-13-testnet-redeploy](../adr/ADR-2026-10-13-testnet-redeploy.md).
Run this once every issue on the launch board is resolved. Mainnet follows the same
steps with mainnet values (`ARC_MAINNET_RPC_URL`, chain id 5042, 48-hour timelock).

Every command runs from `packages/contracts` with Arc Foundry installed
(`scripts/install-arc-foundry.sh`). Load the env first:

```sh
cd packages/contracts
set -a && source .env && set +a
```

## 0. Prerequisites

| Item                                                                                                                                                         | Where                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Testnet KMS keys for the relayer and the scheduler                                                                                                           | `docs/runbooks/kms-signers.md` sections 1–3 |
| Their addresses as `STRIMZ_RELAYER_ADDRESS` and `STRIMZ_SCHEDULER_ADDRESS`                                                                                   | `.env`                                      |
| A Safe on Arc testnet, threshold 2 or more                                                                                                                   | Safe web app, custom network Arc testnet    |
| `STRIMZ_SAFE_ADDRESS`, optional `STRIMZ_GUARDIAN_ADDRESS`                                                                                                    | `.env`                                      |
| A new deployer key with testnet USDC (`STRIMZ_DEPLOYER_PRIVATE_KEY`)                                                                                         | `faucet.circle.com`                         |
| Merchant and payer test keys for `e2e.sh` (`STRIMZ_MERCHANT_PRIVATE_KEY`, `STRIMZ_PAYER_PRIVATE_KEY`, `STRIMZ_MERCHANT_PAYOUT_ADDRESS`), payer with 2.1 USDC | `.env`                                      |
| The key of `0xd9dB…E645`, the July contracts' admin, to pause them                                                                                           | your records                                |
| `TURNSTILE_SECRET_KEY` and Privy CAPTCHA, for the Lightsail redeploy (#133)                                                                                  | Lightsail `.env`, Privy                     |
| `NEXT_PUBLIC_ARC_ENVIRONMENT=testnet` on Vercel (#138)                                                                                                       | Vercel                                      |

`TIMELOCK_MIN_DELAY=300` on testnet (5 minutes, #129 H2); 172800 (48 hours) on mainnet.

## 1. Rehearse

```sh
./script/rehearse.sh
```

It forks Arc testnet locally with `arc-anvil` (chain id 31337). On the fork it:

- deploys core and agent and runs `Verify` (`deployed`);
- runs the five `e2e.sh` flows;
- creates a 2-of-3 Safe and hands off admin;
- runs `Verify` (`handed-off`).

It spends nothing, and its log goes to the ignored `deployments/31337.json`. Do not go on
unless it ends with `Rehearsal passed`.

## 2. Deploy core and agent

```sh
arc-forge clean && arc-forge build
arc-forge script script/DeployCore.s.sol --network arc --rpc-url arc_testnet --broadcast -vvv
```

Export the new addresses (section 4 of the contracts README), then:

```sh
arc-forge script script/DeployAgent.s.sol --network arc --rpc-url arc_testnet --broadcast -vvv
```

Note the block of the `DeployCore` transactions: it becomes the indexer's `START_BLOCK`.

## 3. Verify the deploy and run the flows

```sh
STRIMZ_VERIFY_PHASE=deployed STRIMZ_ADMIN_ADDRESS=$(arc-cast wallet address --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY") \
  arc-forge script script/Verify.s.sol --network arc --rpc-url arc_testnet
./script/e2e.sh
```

Keep the transaction hashes `e2e.sh` prints for the release note follow-up.

## 4. Hand off admin

```sh
arc-forge script script/HandoffAdmin.s.sol --network arc --rpc-url arc_testnet --broadcast -vvv
STRIMZ_VERIFY_PHASE=handed-off \
STRIMZ_TIMELOCK_ADDRESS=<TimelockController from deployments/5042002.json> \
STRIMZ_DEPLOYER_ADDRESS=$(arc-cast wallet address --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY") \
  arc-forge script script/Verify.s.sol --network arc --rpc-url arc_testnet
```

The deployer holds no role afterwards. The relayer and scheduler KMS addresses hold
`MERCHANT_REGISTRAR_ROLE` and `CHARGER_ROLE`.

## 5. Publish the source

```sh
./script/verify.sh
```

## 6. Pause the old contracts

The old Payments and Subscriptions are immutable. Pause them with the key of
`0xd9dBe0daa503Caa6e061f1902a7AF22af096E645`, which holds `STRIMZ_ADMIN_ROLE` on both
(checked on 2026-10-13, and a simulated `pause()` from it succeeds), so no payer can reach
unfixed code.

The `deployer` field of the older entries in `deployments/5042002.json` shows
`0x1804…1f38`, Foundry's default script sender, not the key that broadcast. This PR
fixes the log to record the real deployer.

```sh
arc-cast send 0x2dfa72f9564bdfeb1b32e77c2fdf7040c69bdc7b "pause()" --private-key "$OLD_DEPLOYER_KEY" --rpc-url arc_testnet
arc-cast send 0xed374f8b4d22361d2487404de34224f74f85fb4c "pause()" --private-key "$OLD_DEPLOYER_KEY" --rpc-url arc_testnet
arc-cast call 0x2dfa72f9564bdfeb1b32e77c2fdf7040c69bdc7b "paused()(bool)" --rpc-url arc_testnet
```

The addresses are the 2026-07-10 `core` entry in `deployments/5042002.json`. Check them
against the live Lightsail `.env` before sending.

## 7. Reset testnet data that points at the old contracts

Run against the testnet database only, after step 2 and before the Lightsail redeploy:

```sql
BEGIN;

UPDATE "Merchant"
   SET "onchainMerchantId" = NULL,
       "onchainRegistrationTxHash" = NULL,
       "onchainRegistrationRequestedAt" = NULL
 WHERE "onchainMerchantId" IS NOT NULL
    OR "onchainRegistrationTxHash" IS NOT NULL
    OR "onchainRegistrationRequestedAt" IS NOT NULL;

UPDATE "Subscription"
   SET status = 'cancelled',
       "cancelledAt" = COALESCE("cancelledAt", now()),
       "cancellationReason" = COALESCE("cancellationReason", 'testnet redeploy')
 WHERE status NOT IN ('cancelled', 'lapsed');

UPDATE "Subscription" SET "onchainSubscriptionId" = NULL WHERE "onchainSubscriptionId" IS NOT NULL;

UPDATE "PaymentSession"
   SET status = 'expired'
 WHERE status IN ('created', 'awaiting_payment', 'submitted');

UPDATE "AgentJob"
   SET status = 'cancelled'
 WHERE status IN ('proposed', 'accepted', 'funded', 'in_progress', 'delivered', 'disputed');

UPDATE "AgentJob" SET "onchainJobId" = NULL WHERE "onchainJobId" IS NOT NULL;

COMMIT;
```

- Merchants re-register on the new registry the next time they create a session,
  invoice or plan.
- The new Subscriptions and AgentEscrow number from 1 again. Clearing the old ids keeps
  the indexer's projections from colliding with them.
- Payments, refunds, transactions and history stay.

## 8. Point the services at the new contracts

Lightsail `.env` (`infra/lightsail/env.example` lists every name):

- `STRIMZ_REGISTRY_ADDRESS`, `STRIMZ_TOKEN_WHITELIST_ADDRESS`,
  `STRIMZ_FEE_COLLECTOR_ADDRESS`, `STRIMZ_PAYMENTS_ADDRESS`,
  `STRIMZ_SUBSCRIPTIONS_ADDRESS` (API);
- `SUBSCRIPTIONS_ADDRESS`, `AGENT_ESCROW_ADDRESS` (scheduler);
- `REGISTRY_ADDRESS`, `PAYMENTS_ADDRESS`, `SUBSCRIPTIONS_ADDRESS`,
  `AGENT_ESCROW_ADDRESS`, `FEE_COLLECTOR_ADDRESS`, `TOKEN_WHITELIST_ADDRESS`, and
  `START_BLOCK` = the block from step 2 (indexer);
- the KMS settings from `docs/runbooks/kms-signers.md` section 5.

Vercel: `NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS` and
`NEXT_PUBLIC_STRIMZ_SUBSCRIPTIONS_ADDRESS`.

Then redeploy Lightsail (`infra/lightsail/README.md`) and the web.

## 9. Check, then record

- One hosted checkout payment relays, and its merchant registers on the new registry
  first.
- One subscription is created and charged by the scheduler.
- The indexer projects both from the new addresses.

Then open the follow-up PR: the new `deployments/5042002.json` entries, the README
table, `infra/lightsail/env.example`, `apps/indexer/.env.example` and the release note
with the transaction hashes.
