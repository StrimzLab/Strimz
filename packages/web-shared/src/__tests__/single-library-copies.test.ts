import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { REPO } from './web-source'

// Apps compile web-shared's source, so its imports resolve from packages/web-shared. A
// library that keeps state (Privy's session, the query cache, toasts) must be the same copy
// the app mounts, or the shared code talks to a provider nobody rendered.
const STATEFUL = [
  '@privy-io/react-auth',
  '@tanstack/react-query',
  'react',
  'react-dom',
  'next',
  'sonner',
]
const SHARED = join(REPO, 'packages/web-shared')

const consumers = readdirSync(join(REPO, 'apps')).filter((app) => {
  const manifest = join(REPO, 'apps', app, 'package.json')
  if (!existsSync(manifest)) return false
  const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  return Boolean(pkg.dependencies?.['@strimz/web-shared'])
})

const resolved = (dir: string, lib: string) => {
  const link = join(dir, 'node_modules', lib)
  return existsSync(link) ? realpathSync(link) : null
}

describe('apps and web-shared use one copy of each stateful library', () => {
  const cases = consumers.flatMap((app) => STATEFUL.map((lib) => [app, lib] as const))

  it.each(cases)('%s: %s', (app, lib) => {
    const mine = resolved(join(REPO, 'apps', app), lib)
    const shared = resolved(SHARED, lib)
    if (!mine || !shared) return
    expect(mine).toBe(shared)
  })

  it('checks the admin app', () => {
    expect(consumers).toContain('admin')
  })
})
