import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const APP = 'src/app/(dashboard)/app'

const PAGES: ReadonlyArray<[string, readonly string[], boolean]> = [
  ['payment-sessions/page.tsx', ['Status'], true],
  ['plans/page.tsx', ['Status'], false],
  ['subscriptions/page.tsx', ['Status'], true],
  ['invoices/page.tsx', ['Status'], true],
  ['refunds/page.tsx', ['Status'], true],
  ['agents/page.tsx', ['Capability', 'Outcome'], true],
  ['webhooks/page.tsx', ['Status', 'Event'], true],
  ['webhooks/endpoints/[id]/page.tsx', ['Status', 'Event'], true],
  ['api-keys/page.tsx', ['Status'], false],
]

describe('every dashboard table uses the filter bar', () => {
  describe.each(PAGES)('%s', (path, multi, dated) => {
    const page = () => read(`${APP}/${path}`)

    it('keeps its filters in the URL', () => {
      expect(page()).toMatch(/useTableFilters\(/u)
      expect(page()).toMatch(/<(React\.)?Suspense/u)
    })

    it.each(multi)('has a %s filter', (label) => {
      expect(page()).toMatch(new RegExp(`<MultiSelectFilter[^>]*?label="${label}"`, 'u'))
    })

    it(dated ? 'has a Date filter' : 'has no Date filter', () => {
      expect(/<DateFilter/u.test(page())).toBe(dated)
    })

    it('passes filters to the table and offers to clear them', () => {
      expect(page()).toMatch(/filters=\{/u)
      expect(page()).toMatch(/onClearFilters=\{/u)
    })

    it('has no hand-made filter chips left', () => {
      expect(page()).not.toMatch(/'border-accent bg-accent\/10 text-accent'/u)
      expect(page()).not.toMatch(/toolbar=\{/u)
    })
  })

  it('starts Plans and API keys on Active', () => {
    expect(read(`${APP}/plans/page.tsx`)).toMatch(/multiFilter\([^)]*\['active'\]\)/u)
    expect(read(`${APP}/api-keys/page.tsx`)).toMatch(/multiFilter\([^)]*\['active'\]\)/u)
  })

  it('keeps search only on Customers and webhook endpoints', () => {
    expect(read(`${APP}/customers/page.tsx`)).not.toMatch(/MultiSelectFilter/u)
  })

  it('drops the old toolbar slot from DataTable', () => {
    expect(read('src/components/dashboard/data-table.tsx')).not.toMatch(/toolbar\??:/u)
  })
})
