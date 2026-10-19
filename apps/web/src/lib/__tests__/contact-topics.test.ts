import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PLANS } from '@strimz/shared-config'
import { describe, expect, it } from 'vitest'
import {
  CONTACT_TOPICS,
  DEMO_MAILTO,
  PRIORITY_SUPPORT_PLANS,
  SUPPORT_EMAIL,
  mailto,
} from '../contact-topics'

describe('contact topics', () => {
  it('route everything to the one public inbox', () => {
    expect(SUPPORT_EMAIL).toBe('support@strimz.finance')
    for (const topic of CONTACT_TOPICS) {
      expect(mailto(topic.subject)).toBe(
        `mailto:support@strimz.finance?subject=${encodeURIComponent(topic.subject)}`,
      )
    }
  })

  it('list each topic once', () => {
    const labels = CONTACT_TOPICS.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toEqual(['Sales', 'Support', 'Security'])
  })

  it('book a demo by email', () => {
    expect(DEMO_MAILTO).toBe('mailto:support@strimz.finance?subject=Demo%20request')
  })

  it('name the plans with priority support from the plan config', () => {
    const expected = Object.values(PLANS)
      .filter((p) => p.prioritySupport)
      .map((p) => p.name)
    expect(PRIORITY_SUPPORT_PLANS).toEqual(expected)
  })
})

describe('contact page', () => {
  it('shows one inbox card, keyed by topic', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../../app/(marketing)/contact/page.tsx', import.meta.url)),
      'utf8',
    )
    expect(page).not.toMatch(/key=\{r\.addr\}/u)
    expect(page).toMatch(/CONTACT_TOPICS/u)
  })
})
