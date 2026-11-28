import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// npm's provenance check refuses a package whose repository isn't the repo that
// published it, so `repository` names StrimzLab/Strimz; readers go to the mirror.
const PUBLISHED = ['sdk', 'sdk-react', 'shared-config', 'shared-crypto', 'shared-types']
const read = (pkg: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', pkg, 'package.json'), 'utf8')) as {
    homepage: string
    repository: { url: string; directory: string }
  }

describe.each(PUBLISHED)('@strimz/%s', (pkg) => {
  it('names the repo that publishes it', () => {
    expect(read(pkg).repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/StrimzLab/strimz.git',
      directory: `packages/${pkg}`,
    })
  })

  it('sends readers to the public mirror', () => {
    expect(read(pkg).homepage).toBe(
      `https://github.com/StrimzLab/strimz-sdk/tree/main/packages/${pkg}#readme`,
    )
  })
})
