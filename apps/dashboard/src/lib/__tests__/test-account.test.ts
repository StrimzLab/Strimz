import { describe, expect, it, vi } from 'vitest'
import type { Merchant } from '@strimz/shared-types'
import { TERMS_VERSION } from '@strimz/shared-config'
import { MerchantNotSyncedError } from '@strimz/web-shared/lib/merchant-api/errors'
import { ensureTestAccount, onboardInputFrom } from '../test-account'

const live = {
  businessName: 'Strimz LTD',
  businessSector: 'Payments',
  countryCode: 'NG',
  websiteUrl: 'https://strimz.finance',
  logoUrl: null,
  phone: null,
  payoutAddress: '0x' + 'a'.repeat(40),
  defaultCurrency: 'USDC',
  onboardingCompleted: true,
  termsVersion: TERMS_VERSION,
} as unknown as Merchant

const merchant = (over: Partial<Merchant>) => ({ ...live, ...over }) as Merchant
const notSynced = () => new MerchantNotSyncedError({ code: 'merchant_not_synced', message: 'x' })
const ok = () => new Response('{}', { status: 200 })

function deps(over: Partial<Parameters<typeof ensureTestAccount>[0]> = {}) {
  return {
    primary: live,
    token: 'tok',
    retrieve: vi.fn().mockResolvedValue(merchant({})),
    sync: vi.fn().mockResolvedValue(ok()),
    onboard: vi.fn().mockResolvedValue(merchant({})),
    acceptTerms: vi.fn().mockResolvedValue(merchant({})),
    ...over,
  }
}

describe('ensureTestAccount (ADR-2026-11-26-test-mode)', () => {
  it('leaves a ready test account alone', async () => {
    const d = deps()
    expect(await ensureTestAccount(d)).toEqual({ kind: 'ready' })
    expect(d.sync).not.toHaveBeenCalled()
    expect(d.onboard).not.toHaveBeenCalled()
    expect(d.acceptTerms).not.toHaveBeenCalled()
  })

  it('creates and onboards a missing test account from the live details', async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValueOnce(notSynced())
      .mockResolvedValueOnce(merchant({ onboardingCompleted: false, termsVersion: null }))
    const d = deps({ retrieve })
    expect(await ensureTestAccount(d)).toEqual({ kind: 'ready' })
    expect(d.sync).toHaveBeenCalledWith('tok')
    expect(d.onboard).toHaveBeenCalledWith(onboardInputFrom(live))
    expect(d.acceptTerms).not.toHaveBeenCalled()
  })

  it('accepts the terms when onboarding left them behind', async () => {
    const d = deps({
      retrieve: vi.fn().mockResolvedValue(merchant({ onboardingCompleted: false })),
      onboard: vi.fn().mockResolvedValue(merchant({ termsVersion: '2020-01-01' })),
    })
    await ensureTestAccount(d)
    expect(d.acceptTerms).toHaveBeenCalledWith(TERMS_VERSION)
  })

  it('asks for a bot check when the test backend wants one', async () => {
    const d = deps({
      retrieve: vi.fn().mockRejectedValue(notSynced()),
      sync: vi.fn().mockResolvedValue(new Response('{}', { status: 428 })),
    })
    expect(await ensureTestAccount(d)).toEqual({ kind: 'needs-check' })
    expect(d.onboard).not.toHaveBeenCalled()
  })

  it('reports a failed sync instead of hiding it', async () => {
    const d = deps({
      retrieve: vi.fn().mockRejectedValue(notSynced()),
      sync: vi.fn().mockResolvedValue(new Response('{}', { status: 503 })),
    })
    await expect(ensureTestAccount(d)).rejects.toThrow(/503/u)
  })

  it('passes other errors through', async () => {
    const d = deps({ retrieve: vi.fn().mockRejectedValue(new Error('network down')) })
    await expect(ensureTestAccount(d)).rejects.toThrow('network down')
    expect(d.sync).not.toHaveBeenCalled()
  })
})

describe('onboardInputFrom', () => {
  it('copies the onboarding fields and leaves empty ones out', () => {
    expect(onboardInputFrom(live)).toEqual({
      businessName: 'Strimz LTD',
      businessSector: 'Payments',
      countryCode: 'NG',
      websiteUrl: 'https://strimz.finance',
      payoutAddress: '0x' + 'a'.repeat(40),
      defaultCurrency: 'USDC',
      acceptedTerms: TERMS_VERSION,
    })
  })

  it('refuses a live account that never finished onboarding', () => {
    expect(() => onboardInputFrom(merchant({ businessSector: null }))).toThrow(/onboarding/u)
  })
})
