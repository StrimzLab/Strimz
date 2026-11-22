import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = readFileSync(join(__dirname, '..', 'components/marketing/fx/gooey-reveal.tsx'), 'utf8')

// #496 (Lighthouse): SplitText's aria: 'auto' puts aria-label on the <p> it splits, which ARIA
// prohibits. Line splits keep whole words in reading order, so no label is needed.
describe('gooey reveal accessibility', () => {
  it('does not label the split paragraph', () => {
    expect(code).toMatch(/SplitText\.create\([^)]*aria: 'none'/su)
    expect(code).not.toContain("aria: 'auto'")
  })
})
