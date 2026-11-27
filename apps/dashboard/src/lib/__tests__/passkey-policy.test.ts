import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { asksStrimzPasskey } from '../passkey-policy'

const SRC = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(SRC, path), 'utf8')

// ADR-2026-11-26-test-mode: test mode holds no real money, so Strimz asks for no passkey there.
// Privy's own prompt on wallet signatures stays (founder, 2026-11-27).
describe('asksStrimzPasskey', () => {
  it('asks in live mode', () => {
    expect(asksStrimzPasskey('live')).toBe(true)
  })

  it('does not ask in test mode', () => {
    expect(asksStrimzPasskey('test')).toBe(false)
  })

  it.each([
    'hooks/use-step-up.ts',
    'components/dashboard/passkey-gate.tsx',
    'components/dashboard/refunds/use-refund-signer.ts',
  ])('%s follows it', (path) => {
    expect(read(path)).toContain('asksStrimzPasskey(')
  })
})
