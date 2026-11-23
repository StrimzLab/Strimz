import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ensureEmbeddedWallet, hasEmbeddedWallet } from '@/lib/embedded-wallet'

const SRC = join(__dirname, '..', '..')
const callback = readFileSync(join(SRC, 'app/(auth)/callback/page.tsx'), 'utf8')
const onboarding = readFileSync(join(SRC, 'app/(auth)/onboarding/page.tsx'), 'utf8')

const google = { type: 'google_oauth', email: 'a@b.co' }
const embedded = {
  type: 'wallet',
  walletClientType: 'privy',
  chainType: 'ethereum',
  address: '0x1',
}

describe('embedded wallet (#543)', () => {
  it('sees only a Privy EVM wallet as the embedded wallet', () => {
    expect(hasEmbeddedWallet([google])).toBe(false)
    expect(hasEmbeddedWallet([google, embedded])).toBe(true)
    expect(hasEmbeddedWallet([{ ...embedded, walletClientType: 'metamask' }])).toBe(false)
    expect(hasEmbeddedWallet([{ ...embedded, chainType: 'solana' }])).toBe(false)
  })

  it('creates a wallet for a headless sign-in that has none', async () => {
    const create = vi.fn().mockResolvedValue({})
    await expect(ensureEmbeddedWallet([google], create)).resolves.toBe('created')
    expect(create).toHaveBeenCalledOnce()
  })

  it('leaves an existing wallet alone', async () => {
    const create = vi.fn()
    await expect(ensureEmbeddedWallet([google, embedded], create)).resolves.toBe('existing')
    expect(create).not.toHaveBeenCalled()
  })

  it('lets a failed creation reach the caller', async () => {
    const create = vi.fn().mockRejectedValue(new Error('privy down'))
    await expect(ensureEmbeddedWallet([google], create)).rejects.toThrow('privy down')
  })

  it('creates the wallet on sign-in before the first sync records the merchant', () => {
    const ensure = callback.indexOf('ensureEmbeddedWallet(')
    expect(ensure).toBeGreaterThan(-1)
    expect(ensure).toBeLessThan(callback.indexOf('syncSession('))
  })

  it('repairs a merchant who has no wallet yet, then syncs again', () => {
    expect(onboarding).toMatch(/ensureEmbeddedWallet\(/u)
    expect(onboarding).toMatch(/syncSession\(/u)
  })

  it('shows a retry instead of waiting forever when the wallet cannot be made', () => {
    expect(onboarding).toMatch(/Try again/u)
  })
})
