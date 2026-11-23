import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAccessToken = vi.fn<() => Promise<string | null>>()
vi.mock('@privy-io/react-auth', () => ({ getAccessToken: () => getAccessToken() }))

const { defaultAccessTokenProvider } = await import('../merchant-api/auth-token')

describe('defaultAccessTokenProvider', () => {
  beforeEach(() => {
    getAccessToken.mockReset()
  })

  it('passes the Privy token through', async () => {
    getAccessToken.mockResolvedValue('tok')
    await expect(defaultAccessTokenProvider()).resolves.toBe('tok')
  })

  it('gives null when nobody is signed in', async () => {
    getAccessToken.mockResolvedValue(null)
    await expect(defaultAccessTokenProvider()).resolves.toBeNull()
  })

  it('lets a Privy failure reach the caller', async () => {
    getAccessToken.mockRejectedValue(new Error('privy is down'))
    await expect(defaultAccessTokenProvider()).rejects.toThrow('privy is down')
  })
})
