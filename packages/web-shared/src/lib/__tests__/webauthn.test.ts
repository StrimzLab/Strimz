import { describe, expect, it } from 'vitest'

import {
  assertionForPrivy,
  base64UrlToBytes,
  bytesToBase64Url,
  requestOptionsFrom,
} from '../webauthn'

describe('base64url', () => {
  it('round-trips bytes without padding', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    const text = bytesToBase64Url(bytes)
    expect(text).not.toMatch(/[+/=]/u)
    expect([...base64UrlToBytes(text)]).toEqual([...bytes])
  })
})

describe('requestOptionsFrom', () => {
  it.each([
    [
      'snake_case',
      {
        challenge: 'AQID',
        allow_credentials: [{ id: 'BAUG', type: 'public-key' }],
        rp_id: 'app.strimz.finance',
        user_verification: 'required',
        timeout: 60000,
      },
    ],
    [
      'camelCase',
      {
        challenge: 'AQID',
        allowCredentials: [{ id: 'BAUG', type: 'public-key' }],
        rpId: 'app.strimz.finance',
        userVerification: 'required',
        timeout: 60000,
      },
    ],
  ])('reads Privy options in %s', (_label, options) => {
    const request = requestOptionsFrom(options)

    expect([...new Uint8Array(request.challenge as ArrayBuffer)]).toEqual([1, 2, 3])
    expect(request.rpId).toBe('app.strimz.finance')
    expect(request.userVerification).toBe('required')
    expect(request.allowCredentials?.map((c) => [...new Uint8Array(c.id as ArrayBuffer)])).toEqual([
      [4, 5, 6],
    ])
  })

  it('refuses options without a challenge', () => {
    expect(() => requestOptionsFrom({ rp_id: 'x' })).toThrow(/challenge/u)
  })
})

describe('assertionForPrivy', () => {
  it('encodes the assertion in the snake_case shape Privy expects', () => {
    const buf = (...b: number[]) => new Uint8Array(b).buffer
    const credential = {
      id: 'BAUG',
      rawId: buf(4, 5, 6),
      type: 'public-key',
      response: {
        clientDataJSON: buf(1),
        authenticatorData: buf(2),
        signature: buf(3),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    }

    expect(assertionForPrivy(credential)).toEqual({
      id: 'BAUG',
      raw_id: 'BAUG',
      type: 'public-key',
      response: { client_data_json: 'AQ', authenticator_data: 'Ag', signature: 'Aw' },
      client_extension_results: {},
    })
  })
})
