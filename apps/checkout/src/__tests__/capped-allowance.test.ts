import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allowanceCap, topUpAllowance, UINT256_MAX } from '@/lib/subscription-allowance'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const RENEW = 'src/app/(checkout)/sub/renew/[subscriptionId]/page.tsx'
const MONTH = 30 * 86_400

// ADR-2026-11-13-capped-subscription-allowance.
describe('capped subscription allowance', () => {
  it('approves 12 charges for an open-ended plan', () => {
    expect(
      allowanceCap({ amount: 25n, interval: MONTH, firstChargeAt: 1_000n, endAt: 0n }),
    ).toEqual({
      value: 300n,
      charges: 12,
    })
  })

  it('approves exactly the charges before the end date', () => {
    const firstChargeAt = 1_000n
    const endAt = firstChargeAt + BigInt(3 * MONTH)
    expect(allowanceCap({ amount: 25n, interval: MONTH, firstChargeAt, endAt })).toEqual({
      value: 75n,
      charges: 3,
    })
  })

  it('counts from the first charge, so a trial adds nothing', () => {
    const trialEnds = 1_000n + 14n * 86_400n
    const capped = allowanceCap({
      amount: 25n,
      interval: MONTH,
      firstChargeAt: trialEnds,
      endAt: 0n,
    })
    expect(capped.charges).toBe(12)
  })

  // #384: a permit replaces the allowance, which the payer's other subscriptions share.
  it('adds the cap to what is already approved, and never shrinks an unlimited approval', () => {
    expect(topUpAllowance(50n, 300n)).toBe(350n)
    expect(topUpAllowance(UINT256_MAX, 300n)).toBe(UINT256_MAX)
    expect(topUpAllowance(UINT256_MAX - 10n, 300n)).toBe(UINT256_MAX)
  })

  it('never defaults the checkout permit to unlimited, and tops up the current allowance', () => {
    const hook = read('src/hooks/use-subscription-checkout.ts')
    expect(hook).not.toMatch(/\?\? UINT256_MAX/u)
    expect(hook).toMatch(/allowanceCap\(/u)
    expect(hook).toMatch(/functionName: 'allowance'/u)
    expect(hook).toMatch(/topUpAllowance\(/u)
  })

  it('tells the payer what they approve, next to the button', () => {
    const page = read('src/app/(checkout)/sub/[planId]/page.tsx')
    expect(page).toMatch(/You&apos;re approving up to/u)
    expect(page).toMatch(/renew/u)
  })

  it('has a renewal page that checks the wallet and covers every state', () => {
    expect(existsSync(join(WEB_ROOT, RENEW))).toBe(true)
    const page = read(RENEW)
    expect(page).toMatch(/payerAddress/u)
    expect(page).toMatch(/isn&apos;t the wallet that subscribed/u)
    expect(page).toMatch(/useAllowanceRenewal\(/u)
    expect(read('src/hooks/use-allowance-renewal.ts')).toMatch(
      /submitCheckoutRelay\([\s\S]*?'allowance',?\s*\)/u,
    )
    expect(page).toMatch(/Approval renewed/u)
    expect(page).toMatch(/Couldn&apos;t load this subscription/u)
  })
})
