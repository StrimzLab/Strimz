import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APPS = join(__dirname, '..', '..', '..', '..', 'apps')

describe('every Worker builds without esbuild name helpers', () => {
  // With keep_names on, esbuild wraps functions in __name(), which inline <script>s (the
  // theme script) can't see, so they throw "__name is not defined" before first paint.
  it.each(['web', 'docs', 'dashboard', 'admin', 'checkout'])('%s', (app) => {
    const config = readFileSync(join(APPS, app, 'wrangler.jsonc'), 'utf8')
    expect(config).toMatch(/"keep_names":\s*false/u)
  })
})
