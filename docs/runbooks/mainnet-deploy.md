# Runbook: deploy the contracts on Arc mainnet

Background:

- [ADR-2026-11-23-mainnet-without-agent-escrow](../adr/ADR-2026-11-23-mainnet-without-agent-escrow.md): mainnet has no agent contracts.
- [ADR-2026-11-22-privy-server-signers](../adr/ADR-2026-11-22-privy-server-signers.md): the relayer and scheduler are Privy wallets.

The steps follow the testnet runbook (`testnet-redeploy.md`), with mainnet values. Each command runs from `packages/contracts`.

## 0. Before you start

| Item                                  | Who             | Notes                                                                                                     |
| ------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| The three Privy mainnet wallets       | done 2026-11-23 | addresses in the private ops manual (`privy-signers.md` step 1)                                           |
| Safe owners A, B and C                | founder         | A = founder, also the guardian; B = teammate; C = offline recovery key. Addresses only.                   |
| A fresh deployer key                  | engineer        | generated straight into `packages/contracts/.env.mainnet` as `STRIMZ_DEPLOYER_PRIVATE_KEY`, never printed |
| 2 USDC on Arc mainnet to the deployer | founder         | gas is paid in USDC; the deploy and handoff use about 0.7 USDC                                            |
| `ARC_MAINNET_RPC_URL`                 | engineer        | `https://rpc.mainnet.arc.io`                                                                              |
| `TIMELOCK_MIN_DELAY=172800`           |                 | 48 hours; the handoff refuses less on mainnet                                                             |

Set `STRIMZ_AGENT_REGISTRY_ADDRESS` and `STRIMZ_AGENT_ESCROW_ADDRESS` to the zero address. If only one of them is set, the handoff refuses to run.

**Set every setting explicitly.** Forge loads `packages/contracts/.env`, the testnet file, for any setting not already in your shell. Leaving the agent addresses unset therefore picks up the testnet ones. Export every address the scripts read (tokens, the five core contracts, agent pair as zero, Safe, guardian, relayer, scheduler, timelock delay) before each step.

**Mainnet addresses stay out of this repo.** It is public. Record them only in the private ops manual. `deployments/5042.json` is gitignored for this reason.

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
STRIMZ_RELAYER_ADDRESS="$PRIVY_RELAYER" \
STRIMZ_SCHEDULER_ADDRESS="$PRIVY_SCHEDULER" \
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

The explorer's upload API sits behind a Cloudflare check that scripts can't pass, so `./script/verify.sh` doesn't work on mainnet. Verify on Sourcify instead; the explorer reads from it. Run this for each implementation, Payments, Subscriptions, the Timelock (`lib/openzeppelin-contracts/contracts/governance/TimelockController.sol:TimelockController`), and each proxy (`lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy`):

```sh
env -u ETHERSCAN_API_KEY -u BLOCKSCOUT_API_KEY \
  arc-forge verify-contract <address> <src/...sol:Contract> \
  --verifier sourcify --verifier-url https://sourcify.dev/server/ \
  --chain-id 5042 --rpc-url arc_mainnet --watch
```

Unset the explorer keys as shown. With one set, forge ignores `--verifier sourcify`, calls the explorer, and prints the key in the error.

Each should end with `Status: match`. Confirm with `https://sourcify.dev/server/v2/contract/5042/<address>`.

## 6. Then

- **Privy:** run `privy-signers.md` step 2 (rules) and step 3 (smoke) with the deployed addresses.
- **Server:**
  - switch the server to mainnet;
  - use a fresh database;
  - no `AGENT_*` addresses;
  - remove dRPC from `ARC_FALLBACK_RPC_URLS`;
  - set `RELAY_PLATFORM_DAILY_CAP=1500`.
- **Fund** the relayer, scheduler and refund wallets with small floats.
- **Record** the addresses, transaction hashes and `deployments/5042.json` in the private ops manual. Not in this repo.
