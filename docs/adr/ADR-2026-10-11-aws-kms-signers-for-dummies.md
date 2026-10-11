# ADR for Dummies: The server stops holding the keys that sign transactions

- **Status:** Accepted (2026-10-11, K1–K7 as recommended)
- **Date:** 2026-10-11

## The Idea

Two Strimz services send blockchain transactions all day. The API pays the gas for
customer payments and registers merchants. The scheduler charges subscriptions when they
are due. Each needs a signing key. Today both keys sit as plain text in a settings file
on the server. Anyone who sees that file, or a backup of it, has the keys for good, and
we would never know they were used.

We move both keys into AWS KMS, a locked box at Amazon that signs on request but never
hands the key out:

1. Amazon creates the keys inside KMS. Nobody ever sees them.
2. The server asks KMS to sign each transaction. Only our server's address is allowed to
   ask, and every request is logged.
3. If something goes wrong, one click at AWS stops all signing. There is no copied key
   that keeps working.

## What the Person Sees

- Merchants and payers: nothing changes.
- The maintainer:
  - creates four keys (two for testnet, two for mainnet) and one restricted AWS user per
    network, following a step-by-step runbook;
  - funds the new addresses and gives them their roles on the contracts.

## Important Limitation

New keys mean new blockchain addresses. On testnet the new addresses get the old ones'
permissions and gas money, and the old keys are retired. Someone who takes over the
running server could still ask KMS to sign until we revoke access. What KMS removes is a
stolen copy that works forever, unseen.

## Choices for the maintainer

- **K1.** How the server proves itself to AWS: a restricted AWS user that works only from
  our server's IP (recommended), or a certificate-based setup that takes more work.
- **K2.** Put the signing code in one shared internal package (recommended), or copy it
  into each service.
- **K3.** Create brand-new keys inside KMS (recommended), or import the current keys and
  keep the addresses.
- **K4.** The live server refuses to start with a plain-text key (recommended), or only
  warns.
- **K5.** Each service checks it got the key it expected and refuses to start if not
  (recommended).
- **K6.** Switch testnet before the #142 redeploy (recommended). Mainnet starts on KMS.
- **K7.** If a payment is mid-retry at the moment the key changes, stop it for a person to
  check rather than retry it with the new key (recommended).

## If we leave AWS later

The AWS part sits in one file behind a small interface. Moving to another signing
service means adding one file and changing settings; the rest of Strimz does not change.

## Impact

- About $4 a month for the keys, plus a small charge per signature.
- Code changes in the API and the scheduler, plus a new internal package. No contract or
  database change.
