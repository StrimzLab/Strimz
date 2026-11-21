import { describe, expect, it } from 'vitest'
import { readWeb, webExists } from './web-source'

// ADR-2026-11-21-custom-auth-screens: our own screens, with Turnstile checked by the API.
describe('signup bot check', () => {
  const signup = readWeb('src/app/(auth)/signup/page.tsx')
  const login = readWeb('src/app/(auth)/login/page.tsx')
  const methods = readWeb('src/components/auth/auth-methods.tsx')
  const callback = readWeb('src/app/(auth)/callback/page.tsx')

  it('renders our own sign-in methods, not the Privy modal', () => {
    for (const page of [signup, login]) {
      expect(page).toMatch(/<AuthMethods\b/u)
      expect(page).not.toMatch(/useLogin\b|PrivyContinueButton/u)
    }
  })

  it('puts the methods behind a Turnstile check and keeps the signup token for the API', () => {
    expect(methods).toMatch(/<TurnstileWidget\b/u)
    expect(methods).toMatch(/saveSignupToken\(/u)
  })

  it('offers no wallet sign-in', () => {
    expect(methods).not.toMatch(/wallet/iu)
  })

  it('asks again on the callback page when the API wants a check', () => {
    expect(callback).toMatch(/428/u)
    expect(callback).toMatch(/<TurnstileWidget\b/u)
  })

  it('no longer serves the web Turnstile verify route', () => {
    expect(webExists('src/app/api/auth/turnstile/verify/route.ts')).toBe(false)
  })
})
