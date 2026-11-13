import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildProductInput } from '@/lib/storefront-product-input'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

// #452: the merchant's default currency is pre-selected when creating things.
describe('default currency', () => {
  it('is named and described honestly in Settings', () => {
    const settings = read('src/app/(dashboard)/app/settings/page.tsx')
    expect(settings).not.toMatch(/Settlement currency/u)
    expect(settings).toMatch(/Default currency/u)
    expect(settings).toMatch(/settle in the token the customer pays with/u)
  })

  it.each([
    'src/components/dashboard/payment-sessions/new-payment-session-dialog.tsx',
    'src/components/dashboard/plans/new-plan-dialog.tsx',
    'src/app/(dashboard)/app/invoices/new/page.tsx',
    'src/app/(dashboard)/app/storefront/page.tsx',
  ])('%s starts on the merchant default', (path) => {
    const form = read(path)
    expect(form).toMatch(/useDefaultCurrency\(\)/u)
    expect(form).not.toMatch(/useState<PaymentCurrency>\('USDC'\)/u)
  })

  it('prices a standalone storefront product in the given currency', () => {
    const result = buildProductInput(
      {
        name: 'Sticker',
        description: '',
        price: '5',
        imageUrl: null,
        type: 'one_time',
        stock: '',
        plan: null,
      },
      'EURC',
    )
    expect(result.ok && result.input.currency).toBe('EURC')
  })
})
