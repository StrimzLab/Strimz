import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

describe('dialog width', () => {
  const dialog = readFileSync(join(REPO_ROOT, 'packages/ui/src/components/dialog.tsx'), 'utf8')
  const content = dialog.slice(dialog.indexOf('export const DialogContent'))

  // A grid column defaults to min-width: auto, so one long URL would widen it past the card.
  it('keeps its single grid column inside the card', () => {
    expect(content).toMatch(/grid-cols-\[minmax\(0,1fr\)\]/u)
  })
})
