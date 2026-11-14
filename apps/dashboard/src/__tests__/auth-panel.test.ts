import { PLANS } from '@strimz/shared-config'
import { describe, expect, it } from 'vitest'
import { AUTH_COPY, authVariant } from '@/components/auth/auth-copy'

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

const allText = (v: keyof typeof AUTH_COPY) => strings(AUTH_COPY[v]).join(' ')

describe('auth side panel', () => {
  it.each([
    ['/signup', 'new'],
    ['/onboarding', 'new'],
    ['/login', 'returning'],
    ['/callback', 'returning'],
  ] as const)('shows %s the %s panel', (path, variant) => {
    expect(authVariant(path)).toBe(variant)
  })

  it.each(['new', 'returning'] as const)('speaks to business owners on the %s panel', (v) => {
    const text = allText(v).toLowerCase()
    for (const banned of ['api', 'next billion', 'chargeback', 'card', 'infrastructure']) {
      expect(text).not.toContain(banned)
    }
  })

  it('takes the free tier from the plan config', () => {
    const free = AUTH_COPY.new.benefits.find((b) => b.title === 'Free to start')
    expect(free?.body).toBe(
      `${(PLANS.free.feeBps ?? 0) / 100}% on your first $${(PLANS.starter.entersAtVolume ?? 0).toLocaleString('en-US')}.`,
    )
  })

  it('has three benefits for new merchants', () => {
    expect(AUTH_COPY.new.benefits).toHaveLength(3)
  })

  it.each(['new', 'returning'] as const)('shows the %s card without a tag', (v) => {
    expect(AUTH_COPY[v].card).not.toHaveProperty('tag')
  })
})
