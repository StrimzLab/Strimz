import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const preview = readFileSync(
  join(__dirname, '..', 'components/marketing/home/dashboard-preview.tsx'),
  'utf8',
)
const hero = readFileSync(join(__dirname, '..', 'components/marketing/home/hero.tsx'), 'utf8')

describe('hero border beam passes behind the floating chips', () => {
  const chips = preview.slice(preview.indexOf('function FloatingChips'))
  const classes = [...chips.matchAll(/className="([^"]*absolute -(?:top|bottom)-4[^"]*)"/gu)].map(
    (m) => m[1] ?? '',
  )

  it('stacks both chips above the beam', () => {
    expect(classes).toHaveLength(2)
    for (const c of classes) expect(c).toMatch(/\bz-20\b/u)
  })

  it('keeps the beam layer below them', () => {
    expect(hero).toMatch(/pointer-events-none absolute inset-0 z-10 rounded-\[14px\]/u)
  })
})
