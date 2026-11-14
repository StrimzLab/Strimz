import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { createSessionCacheGuard } from '../session-cache'

function seededClient(): QueryClient {
  const client = new QueryClient()
  client.setQueryData(['merchant', 'me'], { id: 'mer_a', name: 'Merchant A' })
  client.setQueryData(['payment-sessions'], { rows: [{ id: 'ps_1' }] })
  return client
}

describe('createSessionCacheGuard', () => {
  it('clears every cached query when the signed-in user logs out', () => {
    const client = seededClient()
    const guard = createSessionCacheGuard(client)

    guard.observe('did:privy:a')
    guard.observe(null)

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  it('clears the cache when a different user takes over the session', () => {
    const client = seededClient()
    const guard = createSessionCacheGuard(client)

    guard.observe('did:privy:a')
    guard.observe('did:privy:b')

    expect(client.getQueryData(['merchant', 'me'])).toBeUndefined()
  })

  it('keeps the cache while the same user stays signed in', () => {
    const client = seededClient()
    const guard = createSessionCacheGuard(client)

    guard.observe('did:privy:a')
    guard.observe('did:privy:a')

    expect(client.getQueryData(['merchant', 'me'])).toEqual({ id: 'mer_a', name: 'Merchant A' })
  })

  it('keeps the cache when a signed-out visitor signs in', () => {
    const client = seededClient()
    const guard = createSessionCacheGuard(client)

    guard.observe(null)
    guard.observe('did:privy:a')

    expect(client.getQueryCache().getAll()).toHaveLength(2)
  })

  it('clears again after a second logout', () => {
    const client = seededClient()
    const guard = createSessionCacheGuard(client)

    guard.observe('did:privy:a')
    guard.observe(null)
    client.setQueryData(['merchant', 'me'], { id: 'mer_b', name: 'Merchant B' })
    guard.observe('did:privy:b')
    guard.observe(null)

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
})
