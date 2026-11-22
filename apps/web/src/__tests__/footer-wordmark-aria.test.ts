import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const footer = readFileSync(join(__dirname, '..', 'components/marketing/footer.tsx'), 'utf8')
const start = footer.search(/<p\s+data-mark\s/u)
const mark = footer.slice(start, footer.indexOf('</p>', start))

// #496 (Lighthouse): aria-label on a <p> is prohibited; the letters are aria-hidden.
describe('footer wordmark', () => {
  it('names itself with screen-reader text, not an aria-label', () => {
    expect(mark).not.toContain('aria-label')
    expect(mark).toMatch(/<span className="sr-only">\{WORDMARK\}<\/span>/u)
  })
})
