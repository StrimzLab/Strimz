# @strimz/shared-crypto

Cryptographic primitives for the Strimz platform. Built on the Web Crypto API so the same code runs unchanged in Node 22, Vercel Edge, Cloudflare Workers, and any modern browser.

## What lives here

| Subpath | Contents |
|---|---|
| `/encoding` | `toHex`, `fromHex`, `toBase64Url`, `utf8ToBytes`, `bytesToUtf8` |
| `/hash` | `sha256`, `sha256Hex` |
| `/hmac` | `hmacSha256`, `hmacSha256Hex` |
| `/random` | `randomBytes`, `randomHex`, `randomBase64Url`, `uuid` |
| `/timing-safe` | `timingSafeEqualBytes`, `timingSafeEqualString` |
| `/webhook` | `signWebhookPayload`, `verifyWebhookSignature` (Stripe-style scheme) |
| `/api-key` | `generateApiKey`, `hashApiKey`, `redactApiKey` |

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

Signatures are HMAC-SHA256 over `"${t}.${payload}"`. The timestamp is bound to the signature so replays are detectable; verification rejects any timestamp outside the tolerance window (default 5 minutes, configured in `@strimz/shared-config/webhooks`).

## API key generation

```ts
import { generateApiKey, hashApiKey } from '@strimz/shared-crypto'

const { secret, hash, prefix, lastFour } = await generateApiKey('secret', 'test')
// Persist { hash, prefix, lastFour, kind: 'secret', mode: 'test' }.
// Return `secret` to the caller once, then drop it from memory.

// On every authenticated request:
const incomingHash = await hashApiKey(req.headers.authorization.slice('Bearer '.length))
const row = await db.apiKey.findUnique({ where: { hash: incomingHash } })
```

## Boundaries

- **No secrets are logged.** `redactApiKey` exists specifically so any diagnostic that must include a key logs only the safe prefix and the last four characters.
- **No Node `Buffer` or `node:crypto`.** Every primitive uses `globalThis.crypto.subtle` and `Uint8Array`.
- **Constant-time compare on signatures.** Signature verification must never short-circuit on the first mismatched byte.
- **The package does not decide policy.** Tolerance windows, key prefixes, and tier thresholds come from `@strimz/shared-config`; this package consumes them.
