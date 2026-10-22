import type { JSX } from 'react'
import { InvoicesMock, SubscriptionsMock } from '../home/billing-mocks'
import { EurcLinkMock, OrderMock, StorefrontMock } from './mocks'
import type { MockKind } from './data'

export const USE_CASE_MOCKS: Record<MockKind, () => JSX.Element> = {
  subscriptions: SubscriptionsMock,
  order: OrderMock,
  storefront: StorefrontMock,
  invoice: InvoicesMock,
  'payment-link': EurcLinkMock,
}
