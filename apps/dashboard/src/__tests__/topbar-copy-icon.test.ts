import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// #581: the wallet address copies with an icon, not the word "copy".
describe('top bar wallet copy button', () => {
  const src = readFileSync(join(__dirname, '..', 'components', 'dashboard', 'topbar.tsx'), 'utf8')

  it('uses an icon that turns into a tick', () => {
    expect(src).not.toMatch(/· copy/u)
    expect(src).toMatch(/<Copy\b/u)
    expect(src).toMatch(/<Check\b/u)
  })

  it('has an accessible name and announces the copy', () => {
    expect(src).toContain('aria-label="Copy wallet address"')
    expect(src).toMatch(/aria-live="polite"/u)
  })
})
