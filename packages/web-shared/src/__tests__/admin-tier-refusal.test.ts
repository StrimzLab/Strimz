import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')

describe('admin merchant page tier refusal', () => {
  const page = readFileSync(join(WEB_ROOT, 'src/app/(admin)/admin/merchants/[id]/page.tsx'), 'utf8')

  it('reads the refusal from the tier mutation error', () => {
    expect(page).toMatch(/tierRefusal\(tierMutation\.error\)/u)
  })

  it('shows the refusal inline as an alert', () => {
    expect(page).toMatch(/role="alert"/u)
  })
})
