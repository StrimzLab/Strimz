import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { readWeb, REPO } from './web-source'

// The CAC certificate: STRIMZ LTD, RC 8624034, registered in Nigeria (ADR-2026-11-21-terms-acceptance).
const ALLOWED_EMAILS = new Set([
  'support@strimz.finance',
  'legal@strimz.finance',
  'hello@strimz.finance',
])

function tracked(pattern: string): string[] {
  const run = spawnSync('git', ['grep', '-hIoiE', pattern, '--', 'apps', 'packages'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  // git grep exits 1 when nothing matches.
  if (run.status === 1) return []
  if (run.status !== 0) throw new Error(run.stderr)
  return run.stdout.split('\n').filter(Boolean)
}

describe('legal identity', () => {
  const terms = readWeb('src/app/(marketing)/legal/terms/page.tsx')
  const privacy = readWeb('src/app/(marketing)/legal/privacy/page.tsx')
  const footer = readWeb('src/components/dashboard/dashboard-footer.tsx')

  it('names the registered company', () => {
    for (const page of [terms, privacy]) {
      expect(page).toMatch(/STRIMZ LTD/u)
      expect(page).toMatch(/RC 8624034/u)
    }
    expect(footer).toMatch(/STRIMZ LTD/u)
  })

  it('puts the terms under Nigerian law and the courts of Abuja', () => {
    expect(terms).toMatch(/laws of the Federal Republic of Nigeria/u)
    expect(terms).toMatch(/Federal Capital Territory, Abuja/u)
    expect(terms).toMatch(/legal@strimz\.finance/u)
  })

  it('never names a company or place Strimz is not', () => {
    expect(tracked('strimz labs|chancery lane|england and wales')).toEqual([])
  })

  it('only uses the three public Strimz mailboxes', () => {
    const used = new Set(tracked('[a-z0-9._%+-]+@strimz\\.(finance|io|com)'))
    expect([...used].filter((e) => !ALLOWED_EMAILS.has(e.toLowerCase()))).toEqual([])
  })
})
