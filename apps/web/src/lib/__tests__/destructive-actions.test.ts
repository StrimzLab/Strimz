import { describe, expect, it } from 'vitest'
import {
  approveAgentJobConfirm,
  cancelPaymentSessionConfirm,
  cancelSubscriptionConfirm,
  removeAdminConfirm,
  revokeApiKeyConfirm,
  suspendAdminConfirm,
  suspendMerchantConfirm,
  voidInvoiceConfirm,
} from '../destructive-actions'

describe('destructive action confirmations', () => {
  it('revoking a key says requests using it are rejected and it cannot be undone', () => {
    const copy = revokeApiKeyConfirm({ name: 'Server', prefix: 'sk_live_ab12', mode: 'live' })
    expect(copy.title).toBe('Revoke API key "Server"?')
    expect(copy.description).toContain('sk_live_ab12')
    expect(copy.description).toContain('rejected')
    expect(copy.description).toContain('cannot be undone')
    expect(copy.confirmLabel).toBe('Revoke key')
  })

  it('voiding an invoice names the amount the customer can no longer pay', () => {
    const copy = voidInvoiceConfirm({ number: 'INV-0042', total: '12500000', currency: 'EURC' })
    expect(copy.title).toBe('Void invoice INV-0042?')
    expect(copy.description).toContain('12.5 EURC')
    expect(copy.description).toContain('cannot be undone')
    expect(copy.confirmLabel).toBe('Void invoice')
  })

  it('cancelling a subscription says it ends now and stops charges', () => {
    const copy = cancelSubscriptionConfirm({ amount: '20000000', currency: 'USDC' })
    expect(copy.description).toContain('immediately')
    expect(copy.description).toContain('20 USDC')
    expect(copy.confirmLabel).toBe('Cancel subscription')
  })

  it('cancelling a payment session says the link stops accepting payment', () => {
    const copy = cancelPaymentSessionConfirm({ amount: '5000000', currency: 'USDC' })
    expect(copy.description).toContain('5 USDC')
    expect(copy.description).toContain('cannot be undone')
  })

  it('suspending a merchant says API keys and the dashboard stop working until reactivated', () => {
    const copy = suspendMerchantConfirm({ businessName: 'Acme' })
    expect(copy.title).toBe('Suspend Acme?')
    expect(copy.description).toContain('API keys')
    expect(copy.description).toContain('reactivate')
  })

  it('suspending and removing an admin say what the admin loses', () => {
    expect(suspendAdminConfirm({ email: 'a@x.io' }).description).toContain('a@x.io')
    const remove = removeAdminConfirm({ email: 'a@x.io' }).description
    expect(remove).toContain('suspended')
    expect(remove).toContain('reactivate')
  })

  it('approving an agent job names the escrowed amount and the vendor', () => {
    const copy = approveAgentJobConfirm({
      amount: '3000000',
      currency: 'USDC',
      vendorAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(copy.description).toContain('3 USDC')
    expect(copy.description).toContain('0x1111…1111')
    expect(copy.description).toContain('escrow')
    expect(copy.confirmLabel).toBe('Approve and fund')
  })
})
