// Converts between Privy's JSON passkey challenge and the browser WebAuthn API.
// Privy has used both snake_case and camelCase field names, so both are read.

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

export function base64UrlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/gu, '+').replace(/_/gu, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function buffer(text: string): ArrayBuffer {
  const bytes = base64UrlToBytes(text)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

type Json = Record<string, unknown>

function pick(o: Json, snake: string, camel: string): unknown {
  return o[snake] ?? o[camel]
}

export function requestOptionsFrom(options: unknown): PublicKeyCredentialRequestOptions {
  const o = (options ?? {}) as Json
  if (typeof o.challenge !== 'string') throw new Error('passkey options have no challenge')
  const allow = pick(o, 'allow_credentials', 'allowCredentials')
  const rpId = pick(o, 'rp_id', 'rpId')
  const userVerification = pick(o, 'user_verification', 'userVerification')
  return {
    challenge: buffer(o.challenge),
    ...(typeof o.timeout === 'number' ? { timeout: o.timeout } : {}),
    ...(typeof rpId === 'string' ? { rpId } : {}),
    ...(typeof userVerification === 'string'
      ? { userVerification: userVerification as UserVerificationRequirement }
      : {}),
    ...(Array.isArray(allow)
      ? {
          allowCredentials: allow.map((c: Json) => ({
            id: buffer(String(c.id)),
            type: 'public-key' as const,
            ...(Array.isArray(c.transports)
              ? { transports: c.transports as AuthenticatorTransport[] }
              : {}),
          })),
        }
      : {}),
  }
}

interface AssertionLike {
  id: string
  rawId: ArrayBuffer
  type: string
  response: {
    clientDataJSON: ArrayBuffer
    authenticatorData: ArrayBuffer
    signature: ArrayBuffer
    userHandle: ArrayBuffer | null
  }
  getClientExtensionResults: () => unknown
}

/** A browser assertion in the snake_case shape Privy's verify endpoint expects. */
export function assertionForPrivy(credential: AssertionLike) {
  const b = (buf: ArrayBuffer) => bytesToBase64Url(new Uint8Array(buf))
  const { response } = credential
  return {
    id: credential.id,
    raw_id: b(credential.rawId),
    type: 'public-key' as const,
    response: {
      client_data_json: b(response.clientDataJSON),
      authenticator_data: b(response.authenticatorData),
      signature: b(response.signature),
      ...(response.userHandle ? { user_handle: b(response.userHandle) } : {}),
    },
    client_extension_results: (credential.getClientExtensionResults() ?? {}) as Record<
      string,
      unknown
    >,
  }
}
