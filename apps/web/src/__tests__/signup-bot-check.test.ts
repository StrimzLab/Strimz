import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')

function read(path: string): string {
  return readFileSync(join(WEB_ROOT, path), 'utf8')
}

describe('signup bot check', () => {
  const signup = read('src/app/(auth)/signup/page.tsx')

  it('leaves the bot check to Privy instead of rendering its own Turnstile widget', () => {
    expect(signup).not.toMatch(/turnstile/iu)
  })

  it('opens Privy without a separate verify call', () => {
    expect(signup).toMatch(/privy\.login\(\)/u)
    expect(signup).not.toMatch(/fetch\(/u)
  })

  it('no longer serves the web Turnstile verify route', () => {
    expect(existsSync(join(WEB_ROOT, 'src/app/api/auth/turnstile/verify/route.ts'))).toBe(false)
  })
})
