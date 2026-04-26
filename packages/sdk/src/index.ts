/**
 * @strimz/sdk
 *
 * Server SDK for the Strimz API. Use `StrimzClient` with a secret key.
 * For browser code, import `StrimzBrowserClient` from `@strimz/sdk/browser`.
 * For webhook verification helpers, import from `@strimz/sdk/webhooks`.
 */

// Primary client.
export { StrimzClient, type StrimzClientOptions } from './client.js'

// Browser client (also available via `@strimz/sdk/browser`).
export { StrimzBrowserClient, type StrimzBrowserClientOptions } from './browser-client.js'

// Errors.
export {
  StrimzError,
  StrimzAuthenticationError,
  StrimzPermissionError,
  StrimzValidationError,
  StrimzNotFoundError,
  StrimzIdempotencyError,
  StrimzRateLimitError,
  StrimzNetworkError,
  StrimzTimeoutError,
  StrimzModeMismatchError,
  classifyError,
  type StrimzErrorCode,
  type StrimzErrorBody,
} from './errors.js'

// Pagination.
export {
  AutoPagingIterator,
  type Page,
  type PaginationParams,
} from './pagination.js'

// Idempotency.
export { generateIdempotencyKey, isValidIdempotencyKey } from './idempotency.js'

// Webhook helpers (also at `@strimz/sdk/webhooks`).
export {
  signWebhookPayload,
  verifyWebhookSignature,
  parseWebhookEvent,
  type StrimzWebhookEvent,
} from './webhooks.js'

// Re-export every entity type so consumers don't need to depend on shared-types
// directly. Apps can `import type { Merchant, PaymentSession } from '@strimz/sdk'`.
export type {
  Merchant,
  ApiKey,
  Customer,
  PaymentSession,
  Transaction,
  SubscriptionPlan,
  Subscription,
  SubscriptionCharge,
  Refund,
  WebhookEndpoint,
  WebhookDelivery,
  Invoice,
  Storefront,
  StorefrontProduct,
  AgentMerchantConfig,
  AgentActivityLog,
  AgentJob,
  ComplianceLog,
  WebhookEventName,
  // Inputs.
  CreatePaymentSessionInput,
  CreateSubscriptionPlanInput,
  CreateSubscriptionInput,
  CreateRefundInput,
  CreateInvoiceInput,
  CreateAgentJobInput,
  CreateApiKeyInput,
  CreateWebhookEndpointInput,
} from '@strimz/shared-types'
