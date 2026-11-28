import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const apps = join(__dirname, '../../../../apps')
const WORKER_APPS = ['web', 'dashboard', 'checkout', 'admin', 'docs']

// #496: Workers serve /_next/static with max-age=0, so every visit re-checks every build file.
describe('Worker asset caching', () => {
  it.each(WORKER_APPS)('%s caches its hashed build files for a year', (app) => {
    const file = join(apps, app, 'public/_headers')
    expect(existsSync(file)).toBe(true)
    const rules = readFileSync(file, 'utf8')
    expect(rules).toMatch(
      /^\/_next\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/mu,
    )
  })
})
