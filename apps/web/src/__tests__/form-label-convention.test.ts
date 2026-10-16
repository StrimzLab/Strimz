import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

function fieldLabel(source: string, required: boolean, text: string): boolean {
  const flag = required ? 'required(?:=\\{true\\})?' : 'required=\\{false\\}'
  return new RegExp(`<FieldLabel[^>]*\\b${flag}[^>]*>\\s*${text}`, 'u').test(source)
}

describe('form label convention: every input says (required) * or (optional)', () => {
  it('onboarding labels every field with FieldLabel and no hand-written (optional)', () => {
    const page = read('src/app/(auth)/onboarding/page.tsx')
    expect(page).toMatch(/<FieldLabel[^>]*required=\{required\}/u)
    expect(page).not.toMatch(/label="[^"]*\(optional\)"/u)
  })

  it.each<[string, string, boolean]>([
    ['src/app/(admin)/admin/broadcasts/page.tsx', 'Audience', true],
    ['src/app/(admin)/admin/broadcasts/page.tsx', 'Merchant', true],
    ['src/app/(admin)/admin/broadcasts/page.tsx', 'Subject', true],
    ['src/app/(admin)/admin/broadcasts/page.tsx', 'Message', true],
    ['src/app/(dashboard)/app/api-keys/page.tsx', 'Scopes', true],
    ['src/app/(dashboard)/app/withdraw/page.tsx', 'Currency', true],
    ['src/app/(dashboard)/app/webhooks/page.tsx', 'Events', true],
    ['src/app/(dashboard)/app/invoices/new/page.tsx', 'Description', true],
    ['src/app/(dashboard)/app/invoices/new/page.tsx', 'Qty', true],
    ['src/app/(dashboard)/app/invoices/new/page.tsx', 'Unit', true],
    ['src/components/store/buy-button.tsx', 'Email', false],
  ])('%s labels %s as required=%s', (path, text, required) => {
    expect(fieldLabel(read(path), required, text)).toBe(true)
  })

  it('the demo merchant marks its custom tip amount optional', () => {
    const tip = readFileSync(
      join(WEB_ROOT, '..', 'demo-merchant', 'src', 'components', 'TipWidget.tsx'),
      'utf8',
    )
    expect(tip).toMatch(/htmlFor="custom"[\s\S]{0,200}\(optional\)/u)
  })
})
