import { describe, expect, it } from 'vitest'
import { readWeb } from './web-source'

const read = (path: string) => readWeb(path)

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
    ['src/components/dashboard/filter-bar/date-filter.tsx', 'From', false],
    ['src/components/dashboard/filter-bar/date-filter.tsx', 'To', false],
  ])('%s labels %s as required=%s', (path, text, required) => {
    expect(fieldLabel(read(path), required, text)).toBe(true)
  })
})
