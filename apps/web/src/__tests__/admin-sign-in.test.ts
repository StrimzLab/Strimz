import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const LOGIN = 'src/app/(admin-auth)/admin/login/page.tsx'

describe('admin sign-in', () => {
  it('has its own page outside the admin shell', () => {
    expect(existsSync(join(WEB_ROOT, LOGIN))).toBe(true)
  })

  it('never creates a merchant or routes through onboarding', () => {
    const page = read(LOGIN)
    expect(page).not.toMatch(/auth\/sync|\/callback|\/onboarding/u)
    expect(page).toMatch(/useLogin\(\{/u)
  })

  it('has the theme toggle', () => {
    expect(read(LOGIN)).toMatch(/<ThemeToggle/u)
  })

  it('is where the admin shell sends signed-out visitors', () => {
    const shell = read('src/components/admin/admin-shell.tsx')
    expect(shell).toMatch(/adminGate\(/u)
    expect(shell).toMatch(/'\/admin\/login/u)
    expect(shell).not.toMatch(/'\/login/u)
  })

  it('is where idle admins land after being signed out', () => {
    expect(read('src/app/(admin)/layout.tsx')).toMatch(
      /<InactivityLogout signInPath="\/admin\/login" \/>/u,
    )
  })
})
