import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const preview = readFileSync(
  join(WEB_ROOT, 'src/components/marketing/home/dashboard-preview.tsx'),
  'utf8',
)
const visibleText = preview.replace(/^\s*(\/\/|\*|\/\*).*$/gmu, '')

describe('homepage hero mock (#272)', () => {
  it('shows no wallet addresses, event names or block numbers above the fold', () => {
    expect(visibleText).not.toMatch(/0x[0-9a-f]{3,}/iu)
    expect(visibleText).not.toMatch(/\b(subscription|payment)\.[a-z_]+\b/u)
    expect(visibleText).not.toMatch(/\bBlock\b/u)
    expect(visibleText).not.toMatch(/\bat_risk\b/u)
  })

  it('shows no "sample data" or "live" label', () => {
    expect(visibleText).not.toMatch(/sample data/iu)
    expect(visibleText).not.toMatch(/>\s*Live\s*</u)
  })

  // The server can't know the motion preference, so the first client render must match it (#353).
  it('reads reduced motion with a server snapshot and remounts scenes when it resolves', () => {
    expect(preview).not.toMatch(/useReducedMotion/u)
    expect(preview).toMatch(/useSyncExternalStore\(/u)
    expect(preview).toMatch(/\(\) => false,?\s*\)/u)
    expect(preview).toMatch(/key=\{`scene-[a-z]+-\$\{reducedMotion\}`\}/u)
  })
})
