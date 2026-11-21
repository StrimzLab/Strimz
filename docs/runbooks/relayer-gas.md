# Relayer gas

Strimz pays the gas for relayed calls from the relayer wallet. This runbook covers what that costs, the limits that cap it, and what to do when an alert fires. Design: [ADR-2026-11-21-relay-gas-protection](../adr/ADR-2026-11-21-relay-gas-protection.md).

## What a call costs

Cost is gas used times the effective gas price, both from the receipt. Arc pays gas in USDC.

### Arc testnet, measured 2026-11-21

From receipts of calls to the testnet `StrimzPayments` (`0x3f99…9ca9`) and `StrimzSubscriptions` (`0xe5ff…1524`), read through the Arcscan testnet API. The effective gas price was about 20 to 21 gwei.

| Call                            | Gas used          | Cost per call (USDC) |
| ------------------------------- | ----------------- | -------------------- |
| `payWithAuthorization`          | 185,053 – 185,377 | 0.0037 – 0.0039      |
| `permitAndCreateSubscription`   | 175,093 – 212,101 | 0.0035 – 0.0042      |
| Merchant cancel (`cancel`)      | 67,215            | 0.0013               |
| Reverted `payWithAuthorization` | 95,714            | 0.0020 – 0.0024      |

- **Not measured yet:** `cancelWithSig` and the USDC `permit` used for allowance renewals. Neither had testnet traffic. Expect less than `cancel` plus a signature check, and about 80k gas.
- **Reverts on retry:** the reverted payments above were resent at a rising fee, which is why their cost climbs.

### Arc mainnet

Launch checklist item. After the first relayed call of each kind, record the same columns here from mainnet receipts. Then confirm or change `RELAY_PLATFORM_DAILY_CAP` and `RELAYER_MIN_BALANCE_USDC`.

## What bounds the spend

| Limit                              | Setting                    | Default                       | What happens past it                                        |
| ---------------------------------- | -------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Relayed calls a day, all merchants | `RELAY_PLATFORM_DAILY_CAP` | 50,000                        | Payers send their own transaction until 00:00 UTC           |
| Relayer balance floor              | `RELAYER_MIN_BALANCE_USDC` | 2                             | Same, until the relayer is topped up                        |
| New merchant registrations a day   | `REGISTRATION_DAILY_CAP`   | 200                           | Later ones wait for the next UTC day                        |
| Per merchant, per day              | plan quota                 | 50 / 500 / 5,000 / 50,000     | That merchant's payers send their own                       |
| Signups per payer wallet           | fixed                      | 3 a day, 1 a day per merchant | That payer sends their own                                  |
| Signups per IP, per merchant       | fixed                      | 10 a day                      | That network sends its own                                  |
| Reverts per payer wallet or IP     | fixed                      | 2 a day                       | That payer or network sends its own for the rest of the day |

At the measured testnet price, the platform cap bounds the worst day at about 50,000 × 0.0042 = **210 USDC**. Lower the cap if that is more than the relayer should ever spend in a day.

A refusal never loses a payment. The API answers `402 relay_unavailable` with the signed call, and checkout offers the payer a button to send it and pay the fee.

## Alerts

All go to `OPS_ALERT_EMAIL`, at most once per day per alert.

- **"Relay platform cap at 50% / 80% / 100% today."** Check for one merchant driving it: look at the `RelayDailyUsage` rows for today, sorted by `submissions`. If the traffic is real, raise `RELAY_PLATFORM_DAILY_CAP` and restart the API. At 100%, payers are already paying their own gas, so nothing is lost while you look.
- **"Relayer below its minimum balance: relaying is paused."** Top up the relayer from the Safe. Relaying resumes within a minute, because the balance is cached for 60 seconds. The scheduler's gas monitor also warns earlier, at 5 USDC.
- **"Relay budget at 80% / exhausted for merchant …"** One merchant is near its quota. If it's a new free merchant you trust, give it the full quota from the admin merchant page ("Relay quota", "Give full quota"). That action is audit-logged.

## Checking one payer or network

Revert and signup counters live in Redis for two days:

- `relay:reverts:payer:<address>:<YYYY-MM-DD>`
- `relay:reverts:ip:<key>:<YYYY-MM-DD>`
- `relay:enrol:payer:<address>:<YYYY-MM-DD>`

The IP key is a hash: these counters never hold a raw IP. A network's key is the `clientKey` on its relay jobs. Deleting a key lifts that limit for the rest of the day.
