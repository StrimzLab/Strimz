import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dialog = readFileSync(
  join(__dirname, '..', '..', '..', 'ui', 'src', 'components', 'dialog.tsx'),
  'utf8',
)

// A tall form (New plan) ran off a desktop screen with no way to reach Create (#486).
describe('dialogs fit the viewport', () => {
  it('caps the dialog height and scrolls its body', () => {
    expect(dialog).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/u)
    expect(dialog).toMatch(/overflow-y-auto/u)
  })

  it('keeps the action buttons in view while the body scrolls', () => {
    const footer = dialog.slice(dialog.indexOf('export const DialogFooter'))
    expect(footer).toMatch(/sticky -bottom-6/u)
  })
})
