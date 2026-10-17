import { describe, it, expect } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import tsupConfig from '../tsup.config.js'

describe('tsup config', () => {
  it('defines __SDK_VERSION__ from package.json', () => {
    const config = Array.isArray(tsupConfig) ? tsupConfig[0] : tsupConfig
    expect(config).toMatchObject({ define: { __SDK_VERSION__: JSON.stringify(pkg.version) } })
  })
})
