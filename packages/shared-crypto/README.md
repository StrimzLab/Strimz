# @strimz/shared-crypto

> Web Crypto primitives for Strimz. HMAC webhook signing, API key generation, AES-256-GCM envelope encryption, and constant-time comparison. Runs anywhere Web Crypto runs.

[![npm version](https://img.shields.io/npm/v/@strimz/shared-crypto.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/shared-crypto)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/shared-crypto.svg)](https://www.npmjs.com/package/@strimz/shared-crypto)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/shared-crypto.svg?label=size)](https://bundlephobia.com/package/@strimz/shared-crypto)
[![types](https://img.shields.io/npm/types/@strimz/shared-crypto.svg)](https://www.npmjs.com/package/@strimz/shared-crypto)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

Every primitive is built on the Web Crypto API
(`globalThis.crypto.subtle`), so the same code runs unchanged in
Node 22, Vercel Edge, Cloudflare Workers, Deno, Bun, and any modern
browser. There is no `node:crypto`, no Buffer, no platform-specific
shim.

## Install

```sh
pnpm add @strimz/shared-crypto
# npm install @strimz/shared-crypto
# yarn add @strimz/shared-crypto
```

## What's inside

Every group is also available as a subpath import.

| Subpath        | Contents                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `/encoding`    | `toHex`, `fromHex`, `toBase64Url`, `utf8ToBytes`, `bytesToUtf8`                                         |
| `/hash`        | `sha256`, `sha256Hex`                                                                                   |
| `/hmac`        | `hmacSha256`, `hmacSha256Hex`                                                                           |
| `/random`      | `randomBytes`, `randomHex`, `randomBase64Url`, `uuid`                                                   |
| `/timing-safe` | `timingSafeEqualBytes`, `timingSafeEqualString`                                                         |
| `/webhook`     | `signWebhookPayload`, `verifyWebhookSignature` (timestamp + HMAC scheme)                                |
| `/api-key`     | `generateApiKey`, `hashApiKey`, `redactApiKey`                                                          |
| `/aes-gcm`     | `encryptAesGcm`, `decryptAesGcm`, `generateAesGcmKey` (envelope encryption for webhook secrets at rest) |

The package root re-exports every subpath.

## Webhook signing

```ts
import { signWebhookPayload, verifyWebhookSignature } from '@strimz/shared-crypto'

// Sender
const header = await signWebhookPayload(JSON.stringify(body), secret)
// → "t=1735123456,v1=abc123...def"

// Receiver
const result = await verifyWebhookSignature(rawBodyString, header, secret)
if (!result.valid) {
  throw new Error(`invalid signature: ${result.reason}`)
}
```

Signatures are HMAC-SHA256 over `"${t}.${payload}"`. The timestamp is
bound to the signature so replays are detectable. Verification rejects
any timestamp outside the tolerance window (default 5 minutes,
configured in `@strimz/shared-config/webhooks`).

## API key generation

```ts
import { generateApiKey, hashApiKey } from '@strimz/shared-crypto'

const { secret, hash, prefix, lastFour } = await generateApiKey('secret', 'test')
// Persist { hash, prefix, lastFour, kind: 'secret', mode: 'test' }.
// Return `secret` to the caller exactly once, then drop it from memory.

// On every authenticated request:
const incomingHash = await hashApiKey(req.headers.authorization.slice('Bearer '.length))
const row = await db.apiKey.findUnique({ where: { hash: incomingHash } })
```

## AES-256-GCM envelope encryption

```ts
import { encryptAesGcm, decryptAesGcm, generateAesGcmKey } from '@strimz/shared-crypto'

const key = await generateAesGcmKey() // 32 bytes, hex-encoded
const ciphertext = await encryptAesGcm('hello world', key)
const plaintext = await decryptAesGcm(ciphertext, key)
```

The ciphertext encoding is `v1:<nonce-hex>:<ciphertext-and-tag-hex>`,
safe to store in a text column. Suitable for envelope-encrypting
small secrets where the key is held outside the data store.

## Runtime support

| Runtime            | Supported |
| ------------------ | --------- |
| Node 22+           | Yes       |
| Browsers           | Yes       |
| Vercel Edge        | Yes       |
| Cloudflare Workers | Yes       |
| Deno / Bun         | Yes       |

## Design notes

- **No secrets are logged.** `redactApiKey` exists specifically so any diagnostic that must include a key logs only the safe prefix and the last four characters.
- **No Node `Buffer` or `node:crypto`.** Every primitive uses `globalThis.crypto.subtle` and `Uint8Array`.
- **Constant-time compare on signatures.** Signature verification never short-circuits on the first mismatched byte.
- **Policy lives elsewhere.** Tolerance windows, key prefixes, and tier thresholds come from `@strimz/shared-config`; this package consumes them.

## Links

- [Documentation](https://strimz.finance/docs)
- [Repository](https://github.com/StrimzLab/Strimz/tree/main/packages/shared-crypto)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/Strimz/issues)

## License

[MIT](./LICENSE) © Strimz
