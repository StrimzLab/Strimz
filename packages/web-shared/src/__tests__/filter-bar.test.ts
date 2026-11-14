import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const BAR = 'src/components/dashboard/filter-bar'

describe('filter bar', () => {
  it('builds its menus on the shared Popover', () => {
    const ui = readFileSync(join(REPO_ROOT, 'packages/ui/src/index.ts'), 'utf8')
    expect(ui).toMatch(/components\/popover/u)
    for (const file of ['multi-select-filter.tsx', 'date-filter.tsx']) {
      expect(read(`${BAR}/${file}`)).toMatch(/PopoverContent/u)
    }
  })

  it('lets each filter be cleared from its button', () => {
    expect(read(`${BAR}/filter-button.tsx`)).toMatch(/aria-label=\{`Clear \$\{label\} filter`\}/u)
  })

  it('labels the custom date inputs as optional', () => {
    const dates = read(`${BAR}/date-filter.tsx`)
    expect(dates.match(/required=\{false\}/gu)?.length).toBe(2)
  })

  it('keeps filters in the URL', () => {
    const hook = read(`${BAR}/use-table-filters.ts`)
    expect(hook).toMatch(/useSearchParams\(\)/u)
    expect(hook).toMatch(/router\.replace\(/u)
    expect(hook).toMatch(/scroll: false/u)
  })

  it('puts filters between search and Columns, and offers to clear them', () => {
    const table = read('src/components/dashboard/data-table.tsx')
    expect(table).toMatch(/filters\?: React\.ReactNode/u)
    expect(table).toMatch(/onClearFilters/u)
    expect(table).toContain('Clear filters')
  })

  it('names Columns menu items after their headers', () => {
    expect(read('src/components/dashboard/data-table.tsx')).toMatch(/columnLabel\(/u)
  })

  describe('Transactions', () => {
    const page = () => read('src/app/(dashboard)/app/transactions/page.tsx')

    it('uses the filter bar and the URL-backed filters', () => {
      expect(page()).toMatch(/useTableFilters\(/u)
      expect(page()).toMatch(/<MultiSelectFilter[\s\S]*label="Status"/u)
      expect(page()).toMatch(/<MultiSelectFilter[\s\S]*label="Kind"/u)
      expect(page()).toMatch(/<DateFilter/u)
      expect(page()).toMatch(/filters=\{/u)
      expect(page()).not.toMatch(/function FilterChips/u)
    })

    it('waits for the URL before rendering the filters', () => {
      expect(page()).toMatch(/<(React\.)?Suspense/u)
    })
  })
})
