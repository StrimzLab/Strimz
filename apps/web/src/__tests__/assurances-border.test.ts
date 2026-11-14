import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(__dirname, '..', 'components/marketing/home/assurances.tsx'),
  'utf8',
)

describe('assurances band (#471)', () => {
  it('draws the green lines as the bottom border inside the navy box', () => {
    const box = source.indexOf('bg-ink')
    const lines = source.indexOf('<PaddedLines')
    const boxEnd = source.lastIndexOf('</div>\n    </section>')
    expect(lines).toBeGreaterThan(box)
    expect(lines).toBeLessThan(boxEnd)
    expect(source).toMatch(/<PaddedLines className="[^"]*absolute inset-x-0 bottom-0/u)
  })
})
