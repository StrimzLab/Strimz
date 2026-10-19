import { describe, expectTypeOf, it } from 'vitest'
import type { StrimzClient } from '../src/index.js'

declare const client: StrimzClient
const customerId = 'cmq4wh9de0006je6l2n5v0kqt'

describe('list methods take a customerId filter', () => {
  it('paymentSessions.list', () => {
    expectTypeOf(client.paymentSessions.list).toBeCallableWith({ customerId })
  })
  it('subscriptions.list', () => {
    expectTypeOf(client.subscriptions.list).toBeCallableWith({ customerId })
  })
  it('transactions.list', () => {
    expectTypeOf(client.transactions.list).toBeCallableWith({ customerId })
  })
  it('refunds.list', () => {
    expectTypeOf(client.refunds.list).toBeCallableWith({ customerId })
  })
  it('invoices.list', () => {
    expectTypeOf(client.invoices.list).toBeCallableWith({ customerId })
  })
})
