import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CHECKOUT = fileURLToPath(new URL('../app/(checkout)', import.meta.url))
const PAY = readFileSync(join(CHECKOUT, 'pay/[sessionId]/page.tsx'), 'utf8')
const SUB = readFileSync(join(CHECKOUT, 'sub/[planId]/page.tsx'), 'utf8')
const SHELL = readFileSync(
  fileURLToPath(new URL('../components/checkout/checkout-shell.tsx', import.meta.url)),
  'utf8',
)

describe('hosted checkout result wiring', () => {
  it.each([
    ['pay', PAY],
    ['sub', SUB],
  ])('%s never sends a cancelling payer to the Strimz homepage', (_name, source) => {
    expect(source).not.toContain("router.push('/')")
    expect(source).toContain('cancelled={cancelled}')
    expect(source).toContain('isCancellable(phase)')
  })

  it('the shell shows the cancelled panel in place of the flow', () => {
    expect(SHELL).toContain('<CancelledPanel')
  })

  it('pay reports its result to the page that opened it', () => {
    expect(PAY).toContain('useCheckoutHost(')
    expect(PAY).toContain('resultMessageForPhase(')
    expect(PAY).toContain("type: 'strimz:checkout:cancel'")
  })

  it('pay fills in the return URL placeholders before redirecting', () => {
    expect(PAY).toContain('buildReturnUrl(')
    expect(PAY).toContain('cancelDestination(')
    expect(PAY).not.toMatch(/window\.location\.href = successUrl/u)
  })

  it('sub reports its result to the page that opened it', () => {
    expect(SUB).toContain('useSubscriptionHost(')
    expect(SUB).toContain('subscriptionResultForPhase(')
    expect(SUB).toContain("type: 'strimz:subscription:cancel'")
    expect(SUB).toContain('waitForSubscriptionId(')
  })

  it('sub fills in the plan return URLs before redirecting', () => {
    expect(SUB).toContain('buildSubscriptionReturnUrl(')
    expect(SUB).toContain('subscriptionCancelDestination(')
    expect(SUB).not.toContain('returnUrl={null}')
    expect(SUB).not.toContain('hostMode="page"')
  })

  it('pay checks the payer wallet before asking for a signature', () => {
    expect(PAY).toContain('isContractAccount(')
  })
})
