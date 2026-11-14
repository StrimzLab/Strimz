import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

describe('auth login flow', () => {
  it('waits for Privy to finish before leaving', () => {
    const button = read('src/components/auth/privy-continue-button.tsx')
    expect(button).toMatch(/useLogin\(\{/u)
    expect(button).toMatch(/onComplete/u)
    expect(button).toMatch(/exited_auth_flow/u)
  })

  it.each(['src/app/(auth)/login/page.tsx', 'src/app/(auth)/signup/page.tsx'])(
    '%s uses the Privy continue button and no longer leaves right after login()',
    (path) => {
      const page = read(path)
      expect(page).toMatch(/<PrivyContinueButton/u)
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
