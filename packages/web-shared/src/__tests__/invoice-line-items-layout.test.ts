import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  resolve(__dirname, '../app/(dashboard)/app/invoices/new/page.tsx'),
  'utf8',
)
const section = page.slice(
  page.lastIndexOf('<CardContent', page.indexOf('Line items')),
  page.indexOf('iv-note'),
)
const COLUMNS = 'grid-cols-[minmax(0,1fr)_7.5rem_10.5rem_7rem_2rem]'

describe('invoice line items layout', () => {
  it('switches to columns by the card width, not the viewport', () => {
    expect(section).toMatch(/@container/)
    expect(section).not.toMatch(/\bsm:(grid|hidden|grid-cols)/)
  })

  it('gives the header and rows the same columns, wide enough for the labels', () => {
    expect(section).not.toMatch(/_80px_/)
    expect(section.split(`@2xl:${COLUMNS}`).length - 1).toBe(2)
  })

  it('keeps each header label on one line, aligned to the bottom', () => {
    const header = section.slice(section.indexOf('hidden'), section.indexOf('lines.map'))
    expect(header).toMatch(/items-end/)
    expect(header).not.toMatch(/uppercase/)
    expect(header.match(/whitespace-nowrap/g)?.length).toBeGreaterThanOrEqual(4)
  })
})
