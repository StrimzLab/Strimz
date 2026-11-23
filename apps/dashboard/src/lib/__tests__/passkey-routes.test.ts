import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SECURITY_TAB, settingsTabFor } from '@/lib/settings-tabs'

const SRC = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')
const onboarding = read('app/(auth)/onboarding/page.tsx')
const gate = read('components/dashboard/passkey-gate.tsx')
const settings = read('app/(dashboard)/app/settings/page.tsx')

describe('passkey step after onboarding (#546)', () => {
  it('only sends merchants who were already onboarded straight to /app', () => {
    expect(onboarding).toMatch(/onboardingCompleted && onboard\.isIdle/u)
  })
})

describe('Add a passkey in Settings (#547)', () => {
  it('opens the tab that holds the passkey settings', () => {
    expect(gate).toMatch(/\/app\/settings\?tab=\$\{SECURITY_TAB\}/u)
    expect(settingsTabFor(SECURITY_TAB)).toBe('business')
    expect(settings).toMatch(/value=\{tab\}/u)
    expect(settings).toMatch(/id="security"/u)
  })

  it('falls back to the business tab for anything unknown', () => {
    expect(settingsTabFor(null)).toBe('business')
    expect(settingsTabFor('nope')).toBe('business')
    expect(settingsTabFor('billing')).toBe('billing')
  })
})
