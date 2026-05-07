import { UnauthorizedException } from '@nestjs/common'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Stand-in for `PrivyService`.
 *
 * Tokens are deterministic strings shaped `test|<privyDid>|<email>|[mfa]`.
 * Anything else throws `UnauthorizedException` to match real Privy behavior.
 *
 *   stub.makeToken({ did: 'did:privy:abc', email: 'a@x.io', mfa: true })
 *   → 'test|did:privy:abc|a@x.io|mfa'
 */
export class StubPrivyService {
  /** Build a deterministic test token. */
  makeToken(opts: { did: string; email: string; mfa?: boolean }): string {
    return `test|${opts.did}|${opts.email}|${opts.mfa ? 'mfa' : ''}`
  }

  async verifyAccessToken(token: string): Promise<{
    userId: string
    sessionId: string
    appId: string
    issuer: string
    issuedAt: number
    expiration: number
  }> {
    if (!token.startsWith('test|')) {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'invalid or expired session',
      })
    }
    const [, did] = token.split('|')
    return {
      userId: did ?? 'did:privy:test',
      sessionId: 'sess_test',
      appId: 'test-app-id',
      issuer: 'privy.io',
      issuedAt: Math.floor(Date.now() / 1000),
      expiration: Math.floor(Date.now() / 1000) + 3600,
    }
  }

  async getUser(privyUserId: string): Promise<any> {
    // We can't reverse the email/mfa from the DID alone, so callers that need
    // that info must call `verifyAccessToken` first and pass the token through
    // to a paired call. For tests we encode it on the synthetic DID:
    //   `did:privy:<email>:<mfa>`
    const decoded = decodeDid(privyUserId)
    return {
      id: privyUserId,
      email: decoded.email ? { address: decoded.email } : undefined,
      linkedAccounts: decoded.email ? [{ type: 'email', address: decoded.email }] : [],
      mfaMethods: decoded.mfa ? [{ type: 'totp' }] : [],
    }
  }

  primaryEmail(user: any): string | null {
    return user?.email?.address?.toLowerCase() ?? null
  }
  primaryWallet(_user: any): string | null {
    return '0x000000000000000000000000000000000000dead'
  }
  hasMfa(user: any): boolean {
    return Array.isArray(user?.mfaMethods) && user.mfaMethods.length > 0
  }
}

/**
 * Encode `email` and `mfa` flags into a synthetic Privy DID so the stub's
 * `getUser()` can return the same data the test set up via `verifyAccessToken`.
 */
export function makePrivyDid(email: string, mfa = false): string {
  return `did:privy:e2e:${encodeURIComponent(email)}:${mfa ? '1' : '0'}`
}

function decodeDid(did: string): { email?: string; mfa?: boolean } {
  const m = did.match(/^did:privy:e2e:([^:]+):([01])$/)
  if (!m) return {}
  return { email: decodeURIComponent(m[1]!), mfa: m[2] === '1' }
}
