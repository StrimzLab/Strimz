import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// ADR-2026-11-14-split-web-into-workers: each app is its own host, so a bare
// path to another app's route 404s. Cross-app links go through `site-urls`.
const REPO = join(__dirname, '..', '..', '..', '..')
const APPS = ['web', 'docs', 'dashboard', 'admin', 'checkout'] as const

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

function firstSegments(app: string): Set<string> {
  const appDir = join(REPO, 'apps', app, 'src', 'app')
  const segs = new Set<string>()
  for (const f of walk(appDir)) {
    if (!/[/\\](page|route)\.tsx?$/.test(f)) continue
    const parts = relative(appDir, f)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !/^\(.*\)$/.test(s))
    segs.add(parts[0] ?? '')
  }
  return segs
}

const LINK =
  /(?:\b[a-zA-Z]*[hH]ref\s*=\s*\{?\s*|[hH]ref:\s*|router\.(?:push|replace)\(\s*|redirect\(\s*)(['"`])(\/[^'"`#?]*)/g

function badLinks(root: string, owned: Set<string>): string[] {
  const bad: string[] = []
  for (const f of walk(root)) {
    if (!/\.tsx?$/.test(f) || /__tests__|\.test\./.test(f)) continue
    for (const m of readFileSync(f, 'utf8').matchAll(LINK)) {
      const path = m[2] ?? ''
      if (path === '/' && owned.has('')) continue
      if (/\.[a-z0-9]+$/i.test(path)) continue
      const seg = (path.split('/')[1] ?? '').replace(/\$\{.*$/, '')
      if (!owned.has(seg)) bad.push(`${relative(REPO, f)}: ${path}`)
    }
  }
  return bad
}

describe('cross-app links', () => {
  for (const app of APPS) {
    it(`apps/${app} links only to its own routes`, () => {
      expect(badLinks(join(REPO, 'apps', app, 'src'), firstSegments(app))).toEqual([])
    })
  }

  it('shared code uses no bare app paths', () => {
    expect(badLinks(join(REPO, 'packages', 'web-shared', 'src'), new Set())).toEqual([])
  })
})
