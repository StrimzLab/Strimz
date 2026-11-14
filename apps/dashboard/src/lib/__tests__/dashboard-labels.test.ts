import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { shouldOpenNew } from '../first-run'

const sidebar = readFileSync(
  fileURLToPath(new URL('../../components/dashboard/sidebar.tsx', import.meta.url)),
  'utf8',
)

describe('dashboard labels', () => {
  it('calls payment sessions payment links and keeps the URL', () => {
    expect(sidebar).toContain("{ href: '/app/payment-sessions', label: 'Payment links'")
    expect(sidebar).not.toContain("label: 'Sessions'")
  })

  it('groups customers under Customers', () => {
    expect(sidebar).toContain("label: 'Customers',\n    links:")
    expect(sidebar).not.toContain("label: 'Buyers'")
    expect(sidebar).toContain("{ href: '/app/customers', label: 'Customers'")
  })
})

describe('opening the new payment link dialog from a link', () => {
  it.each([
    ['new=1', true],
    ['new=true', false],
    ['', false],
    ['status=open', false],
  ])('%s opens it: %s', (query, expected) => {
    expect(shouldOpenNew(new URLSearchParams(query))).toBe(expected)
  })
})
