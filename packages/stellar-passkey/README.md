# @strimz/stellar-passkey

Strimz-side integration of [`stellar-passkeyUI`](https://github.com/jes-labs/stellar-passkeyui) —
a themed passkey enrolment flow + Soroban smart-wallet address derivation,
sized for the Strimz merchant onboarding form.

## What's in the box

| Export                        | Where                           | Purpose                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `<MerchantPasskeyEnrol />`    | `@strimz/stellar-passkey/react` | A drop-in React component for the onboarding step — runs the create-passkey ceremony, derives the merchant's smart-wallet contract address, returns it to the caller via `onEnrolled`.                                                                                            |
| `deriveMerchantWalletAddress` | `@strimz/stellar-passkey`       | Framework-free helper. Given a passkey credential id + deployer + network passphrase, returns the deterministic Soroban contract address the smart wallet will deploy to. Mirrors the upstream `deriveWalletAddress` so the merchant address is known before any on-chain action. |
| `StellarNetwork`              | `@strimz/stellar-passkey`       | Convenience type — `'testnet'                                                                                                                                                                                                                                                     | 'pubnet'`. |

## Why a Strimz wrapper

Apps/web (and any other Strimz consumer) imports `@strimz/stellar-passkey`
only. Versioning, theming, and the underlying `@passkey-ui/*` lineage are
private to this package. If stellar-passkeyUI ships a breaking change, the
fix is contained here — not spread across every consumer.

## Upstream

`@passkey-ui/core` + `@passkey-ui/ui` are linked via `file:` to the sibling
`stellar-passkeyUI/` checkout (`../../../stellar-passkeyUI/packages/{core,ui}`).
The upstream must be built first (`pnpm -r --filter "./packages/*" run build`
inside `stellar-passkeyUI/`) so `dist/` exists. CI does this as a pre-step.

When the upstream library ships an npm release, swap the `file:` deps for
semver — no consumer changes required.
