import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(__dirname, '../app/(dashboard)/app/withdraw/page.tsx'), 'utf8')
const hook = readFileSync(resolve(__dirname, '../hooks/use-withdraw-gas-quote.ts'), 'utf8')

describe('withdraw form', () => {
  it('clears the amount once the transfer is signed', () => {
    const afterSend = page.slice(page.indexOf('setLastTx(hash'))
    expect(afterSend.slice(0, 300)).toMatch(/setAmount\(''\)/)
  })

  it('skips the fee quote when the selected token balance is zero', () => {
    expect(hook).toMatch(/enabled:\s*Boolean\(wallet && token && destination && hasBalance\)/)
    expect(page).toMatch(/hasBalance:\s*selectedRaw > 0n/)
    expect(page).toMatch(/You have no \{currency\} to withdraw/)
  })

  it('shows a short fee error, not the raw viem message', () => {
    expect(page).not.toMatch(/gasQuery\.error\.message/)
    expect(page).not.toMatch(/fresh\.error\?\.message/)
    expect(page).toMatch(/feeQuoteMessage\(/)
  })

  it('describes Arc settlement as sub-second', () => {
    expect(page).not.toMatch(/~13s/)
    expect(page).toMatch(/Settles in under a second/)
  })
})
