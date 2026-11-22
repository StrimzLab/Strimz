# Runbook: mainnet signers on Privy server wallets

Background: [ADR-2026-11-22-privy-server-signers](../adr/ADR-2026-11-22-privy-server-signers.md). Testnet keeps its plain keys ([ADR-2026-11-13-testnet-software-signer](../adr/ADR-2026-11-13-testnet-software-signer.md)).

Three Privy wallets sign Strimz's mainnet transactions:

| Wallet    | Service   | Setting                     | Address setting            |
| --------- | --------- | --------------------------- | -------------------------- |
| Relayer   | API       | `PRIVY_RELAYER_WALLET_ID`   | `KMS_SIGNER_ADDRESS`       |
| Scheduler | scheduler | `PRIVY_SCHEDULER_WALLET_ID` | `SCHEDULER_SIGNER_ADDRESS` |
| Refund    | scheduler | `PRIVY_REFUND_WALLET_ID`    | `REFUND_SIGNER_ADDRESS`    |

## The two Privy keys

Both are in the Privy dashboard, under Wallet infrastructure, Keys and quorums. The IDs aren't secret; the private keys are.

| Key                   | ID                         | Where the private key lives                                                  | What it can do                                                  |
| --------------------- | -------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Strimz owner          | `zn1vk5biyybe3d5hvsdevaw2` | The team password manager only. Never on the server.                         | Change a wallet's rules or signers, export or delete.           |
| Strimz mainnet signer | `hpa8jye8ydedlfk77bgcmjc3` | Server `.env` as `PRIVY_SIGNER_AUTHORIZATION_KEY`, and the password manager. | Ask for signatures that the wallet's rules allow. Nothing else. |

## What each wallet may sign

Privy refuses everything else. The rules live in `packages/signer/src/privy-policies.ts`. Tests in the API and scheduler fail if a service starts making a call the rules don't cover.

- **Relayer:**
  - `payWithAuthorization` on Payments;
  - `permitAndCreateSubscription` and `cancelWithSig` on Subscriptions;
  - `registerMerchant` on the Registry;
  - `permit` on USDC.
- **Scheduler:**
  - `batchCharge` and `cancel` on Subscriptions;
  - `commitFeeBps` and `setFeeBps` on the Registry.
- **Refund:** `transfer` on USDC or EURC, at most 5 tokens per transfer.

Every rule also requires that no value is attached. These rules were checked against Privy's policy engine on 2026-11-22: every allowed call signed, and calls to other contracts, unlisted functions, attached value and refunds over 5 were refused.

## Setup at mainnet launch

Run from `packages/signer` on your own computer, after `pnpm install` and `pnpm --filter @strimz/signer build`. Export the settings in your shell. Don't put them in a file in the repo.

```bash
export PRIVY_APP_ID=...            # the Strimz Privy app
export PRIVY_APP_SECRET=...
export PRIVY_OWNER_KEY_QUORUM_ID=zn1vk5biyybe3d5hvsdevaw2
export PRIVY_SIGNER_KEY_QUORUM_ID=hpa8jye8ydedlfk77bgcmjc3
```

### 1. Create the wallets, before the contract deploy

```bash
pnpm privy:setup wallets
```

This creates three wallets owned by the owner key, with no rules and no server key. Nobody can sign with them yet. It prints each wallet's ID and address. Rerunning it prints the same wallets.

Use the three addresses in the mainnet deploy and admin handoff:

- the relayer gets `MERCHANT_REGISTRAR_ROLE`;
- the scheduler gets `CHARGER_ROLE`, `SUBSCRIPTION_CANCELLER_ROLE` and `FEE_MANAGER_ROLE`;
- the refund wallet gets no role.

### 2. Attach the rules and the server key, after the deploy

```bash
export STRIMZ_PAYMENTS_ADDRESS=0x...       # from the mainnet deploy
export STRIMZ_SUBSCRIPTIONS_ADDRESS=0x...
export STRIMZ_REGISTRY_ADDRESS=0x...
read -rs PRIVY_OWNER_AUTHORIZATION_KEY && export PRIVY_OWNER_AUTHORIZATION_KEY   # paste, then Enter
pnpm privy:setup policies
unset PRIVY_OWNER_AUTHORIZATION_KEY
```

USDC and EURC come from `@strimz/shared-config`. A wallet that already has rules is skipped.

### 3. Check the rules before any money moves

```bash
read -rs PRIVY_SIGNER_AUTHORIZATION_KEY && export PRIVY_SIGNER_AUTHORIZATION_KEY
pnpm privy:setup smoke
unset PRIVY_SIGNER_AUTHORIZATION_KEY
```

This asks Privy to sign each allowed call, and several calls that must be refused. Nothing is broadcast. If any line says `FAIL`, stop and don't fund the wallets.

### 4. Switch the services

In the server `.env`, with no plain keys left in it:

```
KMS_PROVIDER=privy
PRIVY_RELAYER_WALLET_ID=...
KMS_SIGNER_ADDRESS=0x...
SCHEDULER_SIGNER_PROVIDER=privy
PRIVY_SCHEDULER_WALLET_ID=...
SCHEDULER_SIGNER_ADDRESS=0x...
REFUND_SIGNER_PROVIDER=privy
PRIVY_REFUND_WALLET_ID=...
REFUND_SIGNER_ADDRESS=0x...
PRIVY_SIGNER_AUTHORIZATION_KEY=...
RELAY_PLATFORM_DAILY_CAP=1500
```

`PRIVY_APP_ID` and `PRIVY_APP_SECRET` are already set. Recreate the container (`docker run --env-file`). At boot, each service checks that its wallet's address matches the configured one, and refuses to start if not.

Then fund the relayer and the refund wallet with small balances.

## Alerts

- **"Privy refused to sign …"**
  - What it means: a wallet's rules refused a call. The job was stopped and not retried.
  - What to do: if Strimz didn't just change its contracts or calls, treat the server's Privy key as exposed. Remove it from the wallets with the owner key, create a new signer key, and add that one instead.
- **"Privy signatures at 40000 for YYYY-MM"**
  - What it means: the free plan covers 50,000 signatures a month, and merchants' own Privy wallet actions count toward it too.
  - What to do: lower `RELAY_PLATFORM_DAILY_CAP` or plan for $0.01 per signature beyond 50,000.

## If the server's Privy key leaks

The key can only sign calls the rules allow, so the worst case is spent gas.

1. In the Privy dashboard, delete the "Strimz mainnet signer" key. Or, with the owner key, remove it from each wallet's signers.
2. Create a new signer key and add it to each wallet with the same rule. The `policies` step can't do this once rules are attached, so use the dashboard or the API with the owner key.
3. Put the new private key in the server `.env` and recreate the container.

## If Privy is down

- **Relaying:** pauses, and checkout asks payers to send their own transaction.
- **Subscription charges and fee refunds:** retry on their next run.

Nothing is lost.
