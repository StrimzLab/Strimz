import { describe, expect, it } from 'vitest'
import { readWeb } from './web-source'

const read = (path: string) => readWeb(path)

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
