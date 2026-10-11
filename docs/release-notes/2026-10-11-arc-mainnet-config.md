---
date: 2026-10-11
feature: Arc mainnet uses Circle's published chain id, RPC, explorer and contract addresses, and a wrong network stops production at boot
scope: fix
scenario-impact: none
---

# Correct Arc mainnet configuration

On mainnet, Strimz could not have sent a transaction. Shared-config named chain
`5040001` and an RPC and an explorer that do not resolve. Its mainnet EURC and CCTP
addresses were testnet copies, and nothing lives at them on mainnet. Native USDC was
declared with 6 decimals instead of 18, so wallets that add the chain from our
definition would show balances 10¹² times too large. The web was pinned to testnet
whatever its setting.

Fixes #138. ADR:
[ADR-2026-10-11-arc-mainnet-config](../adr/ADR-2026-10-11-arc-mainnet-config.md)
([plain-English version](../adr/ADR-2026-10-11-arc-mainnet-config-for-dummies.md)), C1 to
C7 as recommended.

## What shipped

- **`@strimz/shared-config` 0.2.0** (published, changeset `arc-mainnet-config`):
  - mainnet chain `5042`, `https://rpc.mainnet.arc.io`, `https://explorer.arc.io`;
  - testnet `https://rpc.testnet.arc.io`, `https://explorer.testnet.arc.io`, same chain id
    and addresses;
  - native USDC with 18 decimals on both;
  - the published mainnet EURC, USYC, CCTP V2 and Gateway addresses;
  - lookups throw on an unknown environment;
  - new helpers for explorer links, chain id to environment, and the boot chain check.
- **API, scheduler and agent.**
  - With `NODE_ENV=production`, an unset `ARC_ENVIRONMENT` refuses boot. Development and
    tests keep `testnet`.
  - The API and the scheduler call `eth_chainId` on `ARC_RPC_URL` at boot in production
    and refuse a chain that does not match `ARC_ENVIRONMENT`.
  - The API fills unset `ARC_USDC_ADDRESS` and `ARC_EURC_ADDRESS` from shared-config. In
    production a set value that differs from shared-config refuses boot.
  - Scheduler emails link to the explorer of their environment.
- **Web.**
  - `NEXT_PUBLIC_ARC_ENVIRONMENT` must be `testnet` or `mainnet`. Unset fails a
    production build; development keeps `testnet`.
  - Privy, the checkout wallets (Reown) and withdrawals use the chain of that
    environment.
  - Explorer links come from shared-config.
- **Tooling and docs.** Env examples, `foundry.toml` (new `arc_mainnet` verifier entry),
  `verify.sh`, the contracts `.env.example` and the READMEs use the `arc.io` domains.
  Preflight and CI build the web with `NEXT_PUBLIC_ARC_ENVIRONMENT=testnet`.

## Operator steps

1. **Vercel:** set `NEXT_PUBLIC_ARC_ENVIRONMENT` (`testnet` today) on every environment
   before the next web deploy, or the build fails.
2. **Lightsail:** `ARC_ENVIRONMENT` must be set; the example already sets it. If
   `ARC_EURC_ADDRESS` or `ARC_USDC_ADDRESS` is set, it must match the table below, or
   delete the line. Optionally move `ARC_RPC_URL` and `ARC_FALLBACK_RPC_URLS` to the
   `arc.io` hosts; the old testnet hosts still answer.
3. **A restart needs the RPC.** In production the API and the scheduler stay down while
   `ARC_RPC_URL` is unreachable at boot.

Mainnet `.env` values (API, scheduler, indexer):

| Setting                | Mainnet value                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ARC_ENVIRONMENT`      | `mainnet`                                                                                                   |
| `ARC_CHAIN_ID`         | `5042` (indexer)                                                                                            |
| `ARC_RPC_URL`          | `https://rpc.mainnet.arc.io`                                                                                |
| `ARC_USDC_ADDRESS`     | `0x3600000000000000000000000000000000000000`                                                                |
| `ARC_EURC_ADDRESS`     | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`                                                                |
| `STABLECOIN_ADDRESSES` | `USDC:0x3600000000000000000000000000000000000000,EURC:0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` (indexer) |

## Verification

- New tests, each run red first:
  - `packages/shared-config/test/networks.test.ts` (21; the package gained vitest);
  - API `config/arc-network-env.test.ts` (7) and `infra/chain/chain-id-check.test.ts` (3);
  - scheduler `arc-network.test.ts` (5);
  - agent `arc-network-env.test.ts` (4);
  - web `arc-network.test.ts` (7).
- An unset `NEXT_PUBLIC_ARC_ENVIRONMENT` fails `next build` with
  `NEXT_PUBLIC_ARC_ENVIRONMENT must be testnet or mainnet, got undefined`.
- Every mainnet address in the built shared-config has code on `rpc.mainnet.arc.io`, and
  that RPC returns chain id 5042:

  | Contract             | Address                                      | Code (bytes) |
  | -------------------- | -------------------------------------------- | ------------ |
  | USDC                 | `0x3600000000000000000000000000000000000000` | 1798         |
  | EURC                 | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | 1798         |
  | USYC                 | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | 183          |
  | TokenMessengerV2     | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | 2175         |
  | MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` | 2175         |
  | GatewayWallet        | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` | 163          |
  | GatewayMinter        | `0x2222222d7164433c4C09B0b0D809a9b52C04C205` | 163          |

- Still to do: after the next testnet redeploy, check the boot log line
  `ARC_RPC_URL serves chain id 5042002 (testnet)` from the API and the scheduler, and
  that a checkout payment's explorer link opens on `explorer.testnet.arc.io`. Mainnet
  contract verification through `explorer.arc.io/api` is unproven until the first
  mainnet deploy.
