import { describe, expect, it } from 'vitest'
import { readWeb, webExists } from './web-source'

function read(path: string): string {
  return readWeb(path)
}

describe('signup bot check', () => {
  const signup = read('src/app/(auth)/signup/page.tsx')

  it('leaves the bot check to Privy instead of rendering its own Turnstile widget', () => {
    expect(signup).not.toMatch(/turnstile/iu)
  })

  it('opens Privy without a separate verify call', () => {
    expect(signup).toMatch(/<PrivyContinueButton/u)
    expect(signup).not.toMatch(/fetch\(/u)
  })

  it('no longer serves the web Turnstile verify route', () => {
    expect(webExists('src/app/api/auth/turnstile/verify/route.ts')).toBe(false)
  })
})
