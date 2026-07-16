/**
 * Query-key factories for the dashboard.
 *
 * Why factories: TanStack Query keys are arrays compared by structural
 * equality. Hand-spelled keys at every call site drift the moment a
 * filter param renames. A factory pins the shape once and produces
 * consistent keys for both reads and invalidations.
 *
 * Each resource follows the same three-tier shape:
 *
 *   root            ['payment-sessions']                 // invalidate everything
 *   list / detail   ['payment-sessions', 'list', {...}]  // invalidate a sub-tree
 *   leaf            ['payment-sessions', 'detail', id]   // invalidate one row
 *
 * Mutations call `queryClient.invalidateQueries({ queryKey: keys.lists() })`
 * to refresh every list view; targeted invalidation on
 * `keys.detail(id)` updates only the relevant detail page.
 *
 * `as const` matters. Without it, TypeScript widens the tuple types
 * and TanStack Query loses the literal-key narrowing that powers
 * `select` typing downstream.
 */

import type { ListApiKeysParams } from '@/lib/merchant-api/resources/api-keys'
import type { ListCustomersParams } from '@/lib/merchant-api/resources/customers'
import type { ListInvoicesParams } from '@/lib/merchant-api/resources/invoices'
import type { ListPaymentSessionsParams } from '@/lib/merchant-api/resources/payment-sessions'
import type { ListRefundsParams } from '@/lib/merchant-api/resources/refunds'
import type { ListSubscriptionPlansParams } from '@/lib/merchant-api/resources/subscription-plans'
import type { ListSubscriptionsParams } from '@/lib/merchant-api/resources/subscriptions'
import type { ListTransactionsParams } from '@/lib/merchant-api/resources/transactions'
import type { ListWebhookDeliveriesParams } from '@/lib/merchant-api/resources/webhook-endpoints'
import type { PaginationParams } from '@/lib/merchant-api'

export const merchantKeys = {
  all: ['merchant'] as const,
  me: () => [...merchantKeys.all, 'me'] as const,
  balance: () => [...merchantKeys.all, 'balance'] as const,
  onchainState: () => [...merchantKeys.all, 'onchain-state'] as const,
}

export const paymentSessionKeys = {
  all: ['payment-sessions'] as const,
  lists: () => [...paymentSessionKeys.all, 'list'] as const,
  list: (params: ListPaymentSessionsParams) => [...paymentSessionKeys.lists(), params] as const,
  details: () => [...paymentSessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentSessionKeys.details(), id] as const,
}

export const subscriptionPlanKeys = {
  all: ['subscription-plans'] as const,
  lists: () => [...subscriptionPlanKeys.all, 'list'] as const,
  list: (params: ListSubscriptionPlansParams) => [...subscriptionPlanKeys.lists(), params] as const,
  details: () => [...subscriptionPlanKeys.all, 'detail'] as const,
  detail: (id: string) => [...subscriptionPlanKeys.details(), id] as const,
}

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  lists: () => [...subscriptionKeys.all, 'list'] as const,
  list: (params: ListSubscriptionsParams) => [...subscriptionKeys.lists(), params] as const,
  details: () => [...subscriptionKeys.all, 'detail'] as const,
  detail: (id: string) => [...subscriptionKeys.details(), id] as const,
}

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: ListCustomersParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: (params: ListApiKeysParams) => [...apiKeyKeys.lists(), params] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (id: string) => [...apiKeyKeys.details(), id] as const,
}

export const webhookEndpointKeys = {
  all: ['webhook-endpoints'] as const,
  lists: () => [...webhookEndpointKeys.all, 'list'] as const,
  list: (params: PaginationParams) => [...webhookEndpointKeys.lists(), params] as const,
  details: () => [...webhookEndpointKeys.all, 'detail'] as const,
  detail: (id: string) => [...webhookEndpointKeys.details(), id] as const,
  allDeliveries: () => [...webhookEndpointKeys.all, 'deliveries'] as const,
  deliveries: (params: ListWebhookDeliveriesParams) =>
    [...webhookEndpointKeys.allDeliveries(), 'list', params] as const,
  delivery: (id: string) => [...webhookEndpointKeys.allDeliveries(), 'detail', id] as const,
}

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (params: ListTransactionsParams) => [...transactionKeys.lists(), params] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
}

export const refundKeys = {
  all: ['refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  list: (params: ListRefundsParams) => [...refundKeys.lists(), params] as const,
  details: () => [...refundKeys.all, 'detail'] as const,
  detail: (id: string) => [...refundKeys.details(), id] as const,
}

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (params: ListInvoicesParams) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
}

export const agentKeys = {
  all: ['agents'] as const,
  config: () => [...agentKeys.all, 'config'] as const,
  activities: () => [...agentKeys.all, 'activity'] as const,
  activity: (params: unknown) => [...agentKeys.activities(), params] as const,
  jobs: () => [...agentKeys.all, 'jobs'] as const,
  jobList: (params: unknown) => [...agentKeys.jobs(), 'list', params] as const,
  jobDetail: (id: string) => [...agentKeys.jobs(), 'detail', id] as const,
}

export const storefrontKeys = {
  all: ['storefront'] as const,
  detail: () => [...storefrontKeys.all, 'detail'] as const,
  products: () => [...storefrontKeys.all, 'products'] as const,
  productList: (params: unknown) => [...storefrontKeys.products(), 'list', params] as const,
  productDetail: (id: string) => [...storefrontKeys.products(), 'detail', id] as const,
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  conversion: (range: { from?: string; to?: string }) =>
    [...analyticsKeys.all, 'conversion', range] as const,
  churn: (range: { from?: string; to?: string }) => [...analyticsKeys.all, 'churn', range] as const,
  mrr: () => [...analyticsKeys.all, 'mrr'] as const,
  ltv: (params: unknown) => [...analyticsKeys.all, 'ltv', params] as const,
  forecast: () => [...analyticsKeys.all, 'forecast'] as const,
}
