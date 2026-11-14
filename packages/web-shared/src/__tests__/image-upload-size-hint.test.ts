import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

describe('image upload size hint', () => {
  const component = read('src/components/dashboard/image-upload.tsx')

  it('says "up to" once, in the component', () => {
    expect(component).toMatch(/PNG or JPG · up to \{maxSizeLabel\}/u)
  })

  it.each(['src/app/(auth)/onboarding/page.tsx', 'src/app/(dashboard)/app/settings/page.tsx'])(
    '%s passes the bare size',
    (page) => {
      const labels = [...read(page).matchAll(/maxSizeLabel="([^"]*)"/gu)].map((m) => m[1])
      expect(labels.length).toBeGreaterThan(0)
      for (const label of labels) expect(label).not.toMatch(/^up to/iu)
    },
  )
})
