# @strimz/stellar-passkey

Strimz-native passkey enrolment + Soroban smart-wallet address
derivation for merchant onboarding. Owns every byte: WebAuthn glue,
capability detection, deterministic contract-address derivation, and
the React component that drives it.

No external SDK dependency beyond `@stellar/stellar-sdk` (canonical
XDR + Strkey + hash) and `@noble/hashes` (for SHA-256). Strimz
controls the surface end-to-end.

## What's here

| Export                                         | Where                           | Purpose                                                                                                                              |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `<MerchantPasskeyEnrol />`                     | `@strimz/stellar-passkey/react` | Drop-in component for the onboarding form. Runs the WebAuthn ceremony, derives the contract address, hands it back via `onEnrolled`. |
| `deriveMerchantWalletAddress`                  | `@strimz/stellar-passkey`       | Pure function. Given a credential id + deployer + network, returns the C-prefixed Strkey the smart wallet will deploy to.            |
| `createPasskey` / `signWithPasskey`            | `@strimz/stellar-passkey`       | WebAuthn wrappers. Used by the React component; reusable by future checkout / sign flows.                                            |
| `detectCapabilities` / `isPasskeySupported`    | `@strimz/stellar-passkey`       | Browser capability snapshot. Drives the "passkeys aren't available" branch in the UI.                                                |
| `toBase64Url` / `fromBase64Url` / `bytesToHex` | `@strimz/stellar-passkey`       | Byte-encoding helpers used at the wire boundary.                                                                                     |
| `NETWORK_PASSPHRASE` / `StellarNetwork`        | `@strimz/stellar-passkey`       | Stellar network passphrase map + type.                                                                                               |

## Design notes

**Contract address derivation matches Soroban's host formula.** The
smart wallet contract id is `SHA-256(envelopeTypeContractId(networkId,
deployer, salt))`, where `salt = SHA-256(credentialId)`. Same input →
same address forever. The address is known at onboarding; deploy is
lazy (M5, on first incoming payment).

**WebAuthn surface is intentionally minimal.** No compatibility matrix,
no fallback-rule engine. The browser detect either supports passkeys
or it doesn't; if it doesn't, the UI shows a clear message and falls
back to "paste an existing Stellar address." This trades some breadth
for an interface we fully understand and own.

**Public key extraction uses `getPublicKey()`**, the modern WebAuthn
API. On browsers that don't expose it (older Safari, embedded
webviews), the credential id is still captured + the contract address
is still derivable; M5 can re-fetch the public key when the wallet
actually deploys.

**Framework-free first, React second.** Server code (the API server,
future indexer) imports from `@strimz/stellar-passkey` without
pulling React. The React component lives under `/react` and reuses
the same primitives.

## Tests

```sh
pnpm --filter @strimz/stellar-passkey test
```

Covers the deterministic address derivation (same input → same
address; different credential / network → different address) + the
base64url + hex encoding round-trips. Browser-dependent paths
(`createPasskey`, `signWithPasskey`, capability detection) are not
unit-tested — they're exercised end-to-end via the onboarding flow.
