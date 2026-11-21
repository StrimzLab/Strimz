import { describe, expect, it } from 'vitest'
import { readWeb } from './web-source'

const read = (path: string) => readWeb(path)

describe('auth login flow', () => {
  it('waits for Privy to finish before leaving', () => {
    const methods = read('src/components/auth/auth-methods.tsx')
    expect(methods).toMatch(/ready && authenticated/u)
    expect(methods).toMatch(/router\.replace\(withNext\('\/callback', next\)\)/u)
  })

  it.each(['src/app/(auth)/login/page.tsx', 'src/app/(auth)/signup/page.tsx'])(
    '%s uses our sign-in methods and never leaves right after starting a login',
    (path) => {
      const page = read(path)
      expect(page).toMatch(/<AuthMethods\b/u)
      expect(page).not.toMatch(/privy\.login\(\)/u)
    },
  )

  it('carries next through the callback', () => {
    expect(read('src/app/(auth)/callback/page.tsx')).toMatch(/safeNextPath\(/u)
  })

  it('guards the dashboard with dashboardGate', () => {
    expect(read('src/components/dashboard/dashboard-shell.tsx')).toMatch(/dashboardGate\(/u)
  })
})
