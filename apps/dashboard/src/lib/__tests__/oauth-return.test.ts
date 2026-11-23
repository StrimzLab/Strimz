import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const methods = readFileSync(
  join(__dirname, '..', '..', 'components/auth/auth-methods.tsx'),
  'utf8',
)

describe('leaving the sign-up page once signed in (#542)', () => {
  it('uses a full navigation that the OAuth clean-up cannot cancel', () => {
    expect(methods).toMatch(/window\.location\.replace\(withNext\('\/callback', next\)\)/u)
    expect(methods).not.toMatch(/router\.replace\(withNext\('\/callback'/u)
  })
})
