import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { USE_CASES } from '@/components/marketing/use-cases/data'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const SECTION = 'src/components/marketing/home/who-its-for.tsx'

describe("homepage 'Who it's for' section", () => {
  it('gives every audience a problem and a fix', () => {
    for (const u of USE_CASES) {
      expect(u.pain, u.id).toMatch(/\S.*\.$/u)
      expect(u.fix, u.id).toMatch(/\S.*\.$/u)
    }
  })

  it('replaces the chip marquee', () => {
    const home = read('src/app/(marketing)/page.tsx')
    expect(home).toContain('<WhoItsFor />')
    expect(home).not.toContain('Sectors')
    expect(existsSync(join(WEB_ROOT, 'src/components/marketing/home/sectors.tsx'))).toBe(false)
    expect(existsSync(join(WEB_ROOT, 'src/components/marketing/fx/marquee.tsx'))).toBe(false)
    expect(read('src/styles/globals.css')).not.toMatch(/marquee/u)
  })

  it('links each audience to its use-case story', () => {
    expect(existsSync(join(WEB_ROOT, SECTION))).toBe(true)
    const source = read(SECTION)
    expect(source).toContain('USE_CASES')
    expect(source).toContain('href={`/use-cases#${u.id}`}')
  })
})
