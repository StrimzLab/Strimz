import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { webTree } from './web-source'

const WEB_ROOT = webTree()
const page = () => readFileSync(join(WEB_ROOT, 'src/app/(admin)/admin/merchants/page.tsx'), 'utf8')

describe('admin merchants filters', () => {
  it('keeps Status and Tier in the URL', () => {
    expect(page()).toMatch(/useTableFilters\(/u)
    expect(page()).toMatch(/<(React\.)?Suspense/u)
  })

  it.each(['Status', 'Tier'])('has a %s filter', (label) => {
    expect(page()).toMatch(new RegExp(`<MultiSelectFilter[^>]*?label="${label}"`, 'u'))
  })

  it('sends the chosen statuses and tiers to the API', () => {
    expect(page()).toMatch(/status: status\.length > 0 \? status : undefined/u)
    expect(page()).toMatch(/tier: tier\.length > 0 \? tier : undefined/u)
  })

  it('keeps searching on the server', () => {
    expect(page()).toMatch(/query: debounced \|\| undefined/u)
  })

  it('offers to clear filters and says when they hide everything', () => {
    expect(page()).toContain('Clear filters')
    expect(page()).toContain('No merchants match these filters')
  })

  it('has no hand-made filter chips left', () => {
    expect(page()).not.toMatch(/'border-accent bg-accent\/10 text-accent'/u)
  })
})
