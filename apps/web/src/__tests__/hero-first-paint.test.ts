import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')
const css = readFileSync(
  join(__dirname, '../../../../packages/web-shared/src/styles/globals.css'),
  'utf8',
)

const HEROES = [
  'components/marketing/home/hero.tsx',
  'components/marketing/page-hero.tsx',
  'components/marketing/pricing/pricing-hero.tsx',
  'components/marketing/use-cases/use-cases-hero.tsx',
]

// #496: phones saw a blank hero until JavaScript loaded, then text that flickered away and back.
describe('hero first paint', () => {
  it('never hides the hero waiting for JavaScript', () => {
    expect(css).not.toMatch(/\[data-intro\]\s*\{[^}]*visibility:\s*hidden/u)
    expect(src('app/(marketing)/layout.tsx')).not.toContain('MOTION_GATE')
  })

  it('plays the intro in CSS from the first frame, and not at all with reduced motion', () => {
    const intro = css.slice(css.indexOf('/* Hero intro'))
    expect(intro).toMatch(/@media \(prefers-reduced-motion: no-preference\)/u)
    for (const part of ['[data-line]', '[data-fade]', '[data-dash]', '[data-fact]']) {
      expect(intro).toContain(`[data-intro]${part}`)
    }
  })

  it.each(HEROES)('%s does not replay the intro with GSAP after hydration', (file) => {
    const code = src(file)
    expect(code).not.toMatch(/\.from\(\s*'\[data-(line|fade|dash|fact)\]'/u)
    expect(code).not.toContain('markMotionReady')
  })
})
