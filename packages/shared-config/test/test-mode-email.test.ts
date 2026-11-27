import { describe, expect, it } from 'vitest'
import { markTestModeEmail, TEST_MODE_EMAIL_NOTE } from '../src/index.js'

const email = {
  subject: 'You received 5.00 USDC',
  html: '<html><body style="margin:0"><p>Paid</p></body></html>',
  text: 'Paid',
}

describe('markTestModeEmail', () => {
  it('labels a testnet email in the subject and the body', () => {
    const out = markTestModeEmail('testnet', email)
    expect(out.subject).toBe('[Test] You received 5.00 USDC')
    expect(out.html).toMatch(/^<html><body style="margin:0"><p [^>]*>Sent from Strimz test mode/u)
    expect(out.html).toContain('<p>Paid</p>')
    expect(out.text).toBe(`${TEST_MODE_EMAIL_NOTE}\n\nPaid`)
  })

  it('leaves a mainnet email as it is', () => {
    expect(markTestModeEmail('mainnet', email)).toEqual(email)
  })

  it('labels HTML without a body tag and leaves a missing text part missing', () => {
    const out = markTestModeEmail('testnet', { subject: 'Hi', html: '<p>Hi</p>' })
    expect(out.html.endsWith('<p>Hi</p>')).toBe(true)
    expect(out.html).toContain(TEST_MODE_EMAIL_NOTE)
    expect(out.text).toBeUndefined()
  })

  it('does not label an email twice', () => {
    const once = markTestModeEmail('testnet', email)
    expect(markTestModeEmail('testnet', once)).toEqual(once)
  })

  it('says no real money moved', () => {
    expect(TEST_MODE_EMAIL_NOTE).toMatch(/no real money/iu)
  })
})
