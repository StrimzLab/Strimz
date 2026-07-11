/**
 * Merchant API. Browser-side typed client for the Strimz dashboard.
 *
 * Composition: every dashboard hook calls into one of the resource
 * methods on this aggregator. The aggregator carries one
 * `MerchantApiClient` instance and exposes per-resource binding objects
 * so call sites can write `api.paymentSessions.list(...)` without
 * importing the resource class directly.
 */

import { AgentsResource } from './resources/agents'
import { AnalyticsResource } from './resources/analytics'
import { ApiKeysResource } from './resources/api-keys'
import { CustomersResource } from './resources/customers'
import { InvoicesResource } from './resources/invoices'
import { MerchantResource } from './resources/merchant'
import { NotificationsResource } from './resources/notifications'
import { PaymentSessionsResource } from './resources/payment-sessions'
import { RefundsResource } from './resources/refunds'
import { StorefrontsResource } from './resources/storefronts'
import { SubscriptionPlansResource } from './resources/subscription-plans'
import { SubscriptionsResource } from './resources/subscriptions'
import { TransactionsResource } from './resources/transactions'
import { WebhookEndpointsResource } from './resources/webhook-endpoints'

import { MerchantApiClient, type MerchantApiClientOptions } from './client'

export class MerchantApi {
  readonly client: MerchantApiClient

  readonly merchant: MerchantResource
  readonly paymentSessions: PaymentSessionsResource
  readonly subscriptionPlans: SubscriptionPlansResource
  readonly subscriptions: SubscriptionsResource
  readonly customers: CustomersResource
  readonly apiKeys: ApiKeysResource
  readonly webhookEndpoints: WebhookEndpointsResource
  readonly transactions: TransactionsResource
  readonly refunds: RefundsResource
  readonly invoices: InvoicesResource
  readonly agents: AgentsResource
  readonly storefronts: StorefrontsResource
  readonly analytics: AnalyticsResource
  readonly notifications: NotificationsResource

  constructor(opts: MerchantApiClientOptions = {}) {
    this.client = new MerchantApiClient(opts)
    this.merchant = new MerchantResource(this.client)
    this.paymentSessions = new PaymentSessionsResource(this.client)
    this.subscriptionPlans = new SubscriptionPlansResource(this.client)
    this.subscriptions = new SubscriptionsResource(this.client)
    this.customers = new CustomersResource(this.client)
    this.apiKeys = new ApiKeysResource(this.client)
    this.webhookEndpoints = new WebhookEndpointsResource(this.client)
    this.transactions = new TransactionsResource(this.client)
    this.refunds = new RefundsResource(this.client)
    this.invoices = new InvoicesResource(this.client)
    this.agents = new AgentsResource(this.client)
    this.storefronts = new StorefrontsResource(this.client)
    this.analytics = new AnalyticsResource(this.client)
    this.notifications = new NotificationsResource(this.client)
  }
}

export { MerchantApiClient } from './client'
export type { MerchantApiClientOptions, RequestOptions } from './client'
export type { Page, PaginationParams, CallOptions } from './types'
export * from './errors'
