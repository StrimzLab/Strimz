import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, readWeb, webExists } from './web-source'

const read = (path: string) => readWeb(path)
const LOGIN = 'src/app/(admin-auth)/admin/login/page.tsx'

describe('admin sign-in', () => {
  it('has its own page outside the admin shell', () => {
    expect(webExists(LOGIN)).toBe(true)
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

describe('admin API token', () => {
  it('comes from the Privy the admin app mounts', () => {
    const providers = readFileSync(join(REPO, 'apps/admin/src/components/providers.tsx'), 'utf8')
    expect(providers).toMatch(/usePrivy\(\)/u)
    expect(providers).toMatch(/new AdminApiClient\(\{ getAccessToken, network \}\)/u)
  })
})

describe('admin write origins', () => {
  it('only allow Strimz origins', () => {
    expect(read('src/app/api/admin/_lib/forward.ts')).not.toMatch(/vercel\.app/u)
  })
})
