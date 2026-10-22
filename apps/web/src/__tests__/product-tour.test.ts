import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { TOUR_LABELS, TOUR_STEPS } from '@/components/marketing/home/tour-data'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const SCENE = 'src/components/marketing/home/tour-scene.tsx'
const SECTION = 'src/components/marketing/home/product-tour.tsx'

const DASHBOARD = [
  'src/components/dashboard/sidebar.tsx',
  'src/components/dashboard/plans/new-plan-dialog.tsx',
  'src/app/(dashboard)/app/page.tsx',
  'src/app/(dashboard)/app/plans/page.tsx',
  'src/app/(dashboard)/app/plans/[id]/page.tsx',
]
  .map(read)
  .join('\n')

describe('homepage product tour (#276)', () => {
  it('sits on the homepage right after How it works', () => {
    const home = read('src/app/(marketing)/page.tsx')
    const how = home.indexOf('<HowItWorks />')
    const tour = home.indexOf('<ProductTour />')
    expect(how).toBeGreaterThan(-1)
    expect(tour).toBeGreaterThan(how)
    expect(home.slice(how + '<HowItWorks />'.length, tour)).not.toMatch(/<[A-Z]\w+ \/>/u)
  })

  it('copies labels the dashboard really uses', () => {
    for (const label of Object.values(TOUR_LABELS)) expect(DASHBOARD, label).toContain(label)
  })

  it('explains the tour in three text steps', () => {
    expect(TOUR_STEPS).toHaveLength(3)
    for (const s of TOUR_STEPS) {
      expect(s.title).toMatch(/\.$/u)
      expect(s.body).toMatch(/\.$/u)
    }
  })

  it('hides the animated window from assistive tech and offers a replay', () => {
    expect(existsSync(join(WEB_ROOT, SCENE))).toBe(true)
    expect(read(SCENE)).toContain('aria-hidden')
    expect(read(SECTION)).toMatch(/>\s*Replay\s*</u)
  })

  it('carries no demo, sample or live label', () => {
    const text = [SCENE, SECTION, 'src/components/marketing/home/tour-data.ts']
      .map(read)
      .join('\n')
      .replace(/^\s*(\/\/|\*|\/\*).*$/gmu, '')
    expect(text).not.toMatch(/\b(demo|sample)\b/iu)
    expect(text).not.toMatch(/>\s*Live\s*<|'Live'/u)
  })
})
