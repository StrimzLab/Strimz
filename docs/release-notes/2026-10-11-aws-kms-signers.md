---
date: 2026-10-11
feature: The relayer and the scheduler sign with AWS KMS keys, and production refuses a plaintext signing key
scope: fix
scenario-impact: needs_automation
---

# AWS KMS signers for the relayer and the scheduler

Both signing keys sat as plaintext in the Lightsail `.env`. Anyone who read that file or
a backup of it held the relayer and the scheduler keys for good, and nothing recorded
their use. In production the API only logged a warning, and the scheduler had no check at
all.

Fixes #137. ADR:
[ADR-2026-10-11-aws-kms-signers](../adr/ADR-2026-10-11-aws-kms-signers.md)
([plain-English version](../adr/ADR-2026-10-11-aws-kms-signers-for-dummies.md)), K1 to
K7 as recommended.

## What shipped

- **`@strimz/signer`** (new private package):
  - the `KmsSigner` interface and the viem account adapter, moved from the API;
  - `SoftwareSigner`, the former `SoftwareKmsProvider`, without Nest;
  - new `AwsKmsSigner`:
    - At boot it reads the key's public key, requires `ECC_SECG_P256K1` with
      `SIGN_VERIFY`, derives the address and refuses a key whose address is not the
      configured one.
    - Each signature is a KMS `Sign` over the 32-byte digest. It decodes the DER result,
      moves `s` into the lower half of the curve order and picks `v` by recovery. A
      signature that recovers to neither parity throws.
- **API.**
  - `KMS_PROVIDER` accepts `aws-kms`, with `KMS_AWS_KEY_ID`, `KMS_SIGNER_ADDRESS` and
    `AWS_REGION`.
  - `KMS_PROVIDER=software` is refused with `NODE_ENV=production`.
  - A plaintext key set next to `aws-kms` is refused.
  - Empty lines for any of these settings count as unset.
- **Scheduler.**
  - `SCHEDULER_SIGNER_PROVIDER` is `software` (default) or `aws-kms`, with
    `SCHEDULER_KMS_KEY_ID`, `SCHEDULER_SIGNER_ADDRESS` and `AWS_REGION`.
  - `ChainService` signs through `@strimz/signer`. Production refuses `software`.
  - The #129 check that the scheduler is not the relayer compares `RELAYER_ADDRESS` with
    `SCHEDULER_SIGNER_ADDRESS` under `aws-kms`.
- **Relay retries.**
  - The relay broadcast record (`@strimz/queue-contracts`, private) gains an optional
    `from`, and the runner records it.
  - A retry whose recorded transaction has not settled and was sent by another address,
    or by an unrecorded one, fails with `relay_signer_changed`. It never reuses another
    address's nonce.
- **Docs.**
  - New runbook `docs/runbooks/kms-signers.md`: keys, address, IAM policy, funding, role
    moves, switch, retiring the old keys, emergency stop, audit.
  - `infra/lightsail/README.md` and the env examples.

## Operator steps

Production now refuses the plaintext keys, so the next Lightsail redeploy needs the KMS
setup first. Follow `docs/runbooks/kms-signers.md` sections 1 to 5 for testnet:

1. Create both keys and the IAM user.
2. Fund the new addresses.
3. Grant `MERCHANT_REGISTRAR_ROLE` and `CHARGER_ROLE` to them.
4. Set the new variables and remove the plaintext keys.

After a payment relays and a subscription charges, revoke the old addresses' roles
(section 7). If the #142 handoff runs after this, use the KMS addresses as
`STRIMZ_RELAYER_ADDRESS` and `STRIMZ_SCHEDULER_ADDRESS`.

`docker compose --profile full` runs the API and the scheduler with
`NODE_ENV=production` and the software signer, so neither starts under that profile until
it gets KMS settings or a non-production `NODE_ENV`.

## Verification

- `packages/signer`: 11 tests against a fake KMS client that signs with a known local
  key, covering:
  - the address taken from the public key, and the wrong-key and wrong-spec refusals;
  - the exact `Sign` request;
  - signatures identical to a local key's;
  - high-s normalisation;
  - a signature from another key, a non-DER signature and a short digest;
  - a full transaction through the viem adapter;
  - the AWS SDK client fitting the narrow client interface.
- API `kms-provider.test.ts` (7) and `relay-signer-change.test.ts` (5); scheduler
  `signer-provider.test.ts` (7); `queue-contracts` keeps `from` and rejects a malformed
  one. Each was run red before the change.
- API e2e 314 and scheduler e2e 44 pass, including the relay runner suite.
- Still to do on Arc testnet after the keys exist:
  - both services boot with `aws-kms`;
  - one hosted checkout payment relays;
  - one subscription charge goes out;
  - CloudTrail shows the matching `Sign` events.
  - The transaction hashes go in a follow-up to this note.
