# ADR for Dummies: Test mode on Arc testnet, beside live mode

- **Status:** Accepted 2026-11-26 by the founder
- **Date:** 2026-11-26

## The Idea

Strimz gets a test mode again. It runs on Arc testnet with free test USDC, so a business can build and try everything without spending money. When it's ready, it switches to live mode, on Arc mainnet with real USDC, by swapping its test keys for live keys. Both modes run on the server Strimz already has.

## What the Person Sees

1. A merchant signs up once. Strimz creates their test account and their live account together.
2. The dashboard opens in **Test**, with a "Test mode" banner at the top.
3. In Test they create test keys and withdraw test USDC with no passkey prompt, then build their integration against free faucet USDC.
4. When they're ready, they flip the switch to **Live**, create live keys and swap them into their app. Live actions ask for the passkey, as today.
5. Emails from test mode start with "[Test]".
6. Anyone can open **Fanline** at `fanline.strimz.finance`, get free test USDC from Circle's faucet, and tip a creator or join Pro. Nothing costs more than 1 USDC.
7. In the admin dashboard, the same switch shows either the test data or the live data.

## Important Limitation

- Test mode depends on Arc testnet and Circle's faucet. If either is down or rate-limited, test mode pauses. Live mode keeps working.
- Test data has no nightly backup.
- Test and live data never mix. A test key only works in test mode, and a live key only in live mode.

## What Changes

- **On the server:** a second Strimz container, `strimz-testnet`, starts next to the live one, with a memory limit. Swap is made permanent.
- **Test checkout:** a new checkout at `checkout-test.strimz.finance`. The test API is at `api-test.strimz.finance`.
- **Dashboard and admin:** one login, and a Test / Live switch.
- **SDK:** it picks the test or live server from the key, so going live is a key swap.
- **Docs:** they explain test mode and the faucet again.
- **Fanline:** back online on testnet, with a 1 USDC limit.
- **Releases:** every backend release is deployed twice, live first, then test.

## What Does Not Change

- Live mode, mainnet and its keys work exactly as now.
- Live actions still need a passkey.
- Solva's containers aren't touched.
- No extra server, so the hosting bill stays the same.
