# Runbook: deploy the contracts on Arc mainnet

Background:

- [ADR-2026-11-23-mainnet-without-agent-escrow](../adr/ADR-2026-11-23-mainnet-without-agent-escrow.md): mainnet has no agent contracts.
- [ADR-2026-11-22-privy-server-signers](../adr/ADR-2026-11-22-privy-server-signers.md): the relayer and scheduler are Privy wallets.

The steps follow the testnet runbook (`testnet-redeploy.md`), with mainnet values. Each command runs from `packages/contracts`.

## 0. Before you start

| Item                                  | Who             | Notes                                                                                                          |
| ------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| The three Privy mainnet wallets       | done 2026-11-23 | relayer `0x2867…e95f`, scheduler `0x0be7…5874`, refund `0x769F…3BCc` (`privy-signers.md` step 1)               |
| Safe owners A, B and C                | founder         | A = founder, also the guardian; B = teammate; C = offline recovery key. Addresses only.                        |
| A fresh deployer key                  | engineer        | generated straight into `packages/contracts/.env` as `STRIMZ_DEPLOYER_PRIVATE_KEY` (gitignored), never printed |
| 2 USDC on Arc mainnet to the deployer | founder         | gas is paid in USDC; the deploy and handoff use about 0.7 USDC                                                 |
| `ARC_MAINNET_RPC_URL`                 | engineer        | `https://rpc.mainnet.arc.io`                                                                                   |
| `TIMELOCK_MIN_DELAY=172800`           |                 | 48 hours; the handoff refuses less on mainnet                                                                  |

Leave `STRIMZ_AGENT_REGISTRY_ADDRESS` and `STRIMZ_AGENT_ESCROW_ADDRESS` unset. If only one of them is set, the handoff refuses to run.

## 1. Rehearse on a fork of mainnet

```sh
REHEARSE_NETWORK=mainnet ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io ./script/rehearse.sh
```

What it does, on a local fork:

- uses fresh test accounts, because the well-known Anvil accounts carry EIP-7702 code on Arc mainnet;
- deploys the core, with no agent contracts;
- runs the five on-chain flows;
- creates a 2-of-3 Safe and hands off admin;
- runs `Verify`.

It spends nothing. Don't continue unless it ends with `Rehearsal passed`.

## 2. Create the Safe

The deployer creates the 2-of-3 Safe through Safe's v1.4.1 factory, which is already on Arc mainnet:

```sh
INITIALIZER=$(arc-cast calldata "setup(address[],uint256,address,bytes,address,address,uint256,address)" \
  "[$OWNER_A,$OWNER_B,$OWNER_C]" 2 0x0000000000000000000000000000000000000000 0x \
  0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99 0x0000000000000000000000000000000000000000 0 0x0000000000000000000000000000000000000000)
SALT=$(date +%s)
SAFE=$(arc-cast call 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 "createProxyWithNonce(address,bytes,uint256)(address)" \
  0x41675C099F32341bf84BFc5382aF534df5C7461a "$INITIALIZER" "$SALT" --from "$DEPLOYER" --rpc-url arc_mainnet)
arc-cast send 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 "createProxyWithNonce(address,bytes,uint256)" \
  0x41675C099F32341bf84BFc5382aF534df5C7461a "$INITIALIZER" "$SALT" --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY" --rpc-url arc_mainnet
arc-cast call "$SAFE" "getThreshold()(uint256)" --rpc-url arc_mainnet   # 2
arc-cast call "$SAFE" "getOwners()(address[])" --rpc-url arc_mainnet    # A, B, C
```

## 3. Deploy the core

```sh
arc-forge clean && arc-forge build
arc-forge script script/DeployCore.s.sol --network arc --rpc-url arc_mainnet --broadcast -vvv
```

`DeployAgent` isn't run on mainnet.

1. Export the five core addresses from `deployments/5042.json`.
2. Note the block of the `DeployCore` transactions. It becomes the indexer's `START_BLOCK`.

Then verify:

```sh
STRIMZ_VERIFY_PHASE=deployed STRIMZ_ADMIN_ADDRESS="$DEPLOYER" \
  arc-forge script script/Verify.s.sol --network arc --rpc-url arc_mainnet
```

## 4. Hand off admin

```sh
STRIMZ_SAFE_ADDRESS="$SAFE" STRIMZ_GUARDIAN_ADDRESS="$OWNER_A" \
STRIMZ_RELAYER_ADDRESS=0x2867d4383C67Ee1b86960220175866920bb5e95f \
STRIMZ_SCHEDULER_ADDRESS=0x0be71EB936539e2B0E81a8aa6D041608D8Ad5874 \
TIMELOCK_MIN_DELAY=172800 \
  arc-forge script script/HandoffAdmin.s.sol --network arc --rpc-url arc_mainnet --broadcast -vvv

STRIMZ_VERIFY_PHASE=handed-off STRIMZ_TIMELOCK_ADDRESS=<TimelockController from deployments/5042.json> \
STRIMZ_DEPLOYER_ADDRESS="$DEPLOYER" \
  arc-forge script script/Verify.s.sol --network arc --rpc-url arc_mainnet
```

After the handoff, the deployer holds no role, and the following are in place:

| Holder             | Roles                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Relayer            | `MERCHANT_REGISTRAR_ROLE`                                                        |
| Scheduler          | `CHARGER_ROLE`, `SUBSCRIPTION_CANCELLER_ROLE`, `FEE_MANAGER_ROLE`                |
| Safe               | `ADMIN_ROLE`, `PAUSER_ROLE` and `TREASURY_ROLE`, and it proposes to the Timelock |
| Guardian (owner A) | can pause, and can cancel a queued Timelock operation                            |

Then send what's left in the deployer back to the founder.

## 5. Publish the source

```sh
./script/verify.sh
```

## 6. Then

- **Privy:** run `privy-signers.md` step 2 (rules) and step 3 (smoke) with the deployed addresses.
- **Server:**
  - switch the server to mainnet;
  - use a fresh database;
  - no `AGENT_*` addresses;
  - remove dRPC from `ARC_FALLBACK_RPC_URLS`;
  - set `RELAY_PLATFORM_DAILY_CAP=1500`.
- **Fund** the relayer and refund wallets with small floats.
- **Record** the new `deployments/5042.json`, the README table and the release note with the transaction hashes.
