import { daysAgo, id, mulberry32, pick, range } from './_seed'

export const ALL_EVENT_TYPES = [
  'payment.created',
  'payment.completed',
  'payment.failed',
  'subscription.created',
  'subscription.charged',
  'subscription.charge_failed',
  'subscription.cancelled',
  'subscription.lapsed',
  'refund.created',
  'refund.completed',
  'refund.failed',
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'agent.action_executed',
  'agent.job_proposed',
] as const

export type WebhookEventType = (typeof ALL_EVENT_TYPES)[number]

export type WebhookEndpointStatus = 'active' | 'disabled'

export type WebhookEndpoint = {
  id: string
  url: string
  description: string
  events: WebhookEventType[]
  status: WebhookEndpointStatus
  signingSecretPrefix: string
  mode: 'live' | 'test'
  createdAt: string
  successCount24h: number
  failureCount24h: number
}

const URLS = [
  'https://hooks.acme.io/strimz',
  'https://api.northwind.io/webhooks/strimz',
  'https://billing.globex.com/strimz/v1',
  'https://internal.tyrell.io/incoming/strimz',
  'https://hooks.cyberdyne.dev/strimz',
  'https://api.hooli.com/billing-events',
]

const rng = mulberry32(13)

export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = range(6).map((i) => ({
  id: id('ep', i + 1),
  url: URLS[i]!,
  description: [
    'Production receiver',
    'Backup receiver',
    'Reconciliation worker',
    'Slack notifier',
    'Audit log',
  ][i % 5]!,
  events:
    i === 0
      ? [...ALL_EVENT_TYPES]
      : (ALL_EVENT_TYPES.slice(0, Math.floor(rng() * 6) + 4) as WebhookEventType[]),
  status: i === 4 ? 'disabled' : 'active',
  signingSecretPrefix: `whsec_${Math.floor(rng() * 1e10).toString(36)}`,
  mode: i < 4 ? 'live' : 'test',
  createdAt: daysAgo(Math.floor(rng() * 200) + 7),
  successCount24h: Math.floor(rng() * 1200) + 50,
  failureCount24h: Math.floor(rng() * 12),
}))

export type WebhookDeliveryStatus = 'delivered' | 'pending' | 'retrying' | 'permanently_failed'

export type WebhookDelivery = {
  id: string
  endpointId: string
  endpointUrl: string
  eventType: WebhookEventType
  status: WebhookDeliveryStatus
  responseCode: number | null
  attemptCount: number
  durationMs: number | null
  createdAt: string
  lastError: string | null
}

const STATUSES: WebhookDeliveryStatus[] = [
  'delivered',
  'delivered',
  'delivered',
  'delivered',
  'delivered',
  'delivered',
  'retrying',
  'retrying',
  'permanently_failed',
  'pending',
]
const ERRORS = [
  '503 Service Unavailable',
  'Connection timeout (10s)',
  '500 Internal Server Error',
  'Connection reset by peer',
  '429 Too Many Requests',
]

export const WEBHOOK_DELIVERIES: WebhookDelivery[] = range(40)
  .map((i) => {
    const ep = pick(rng, WEBHOOK_ENDPOINTS)
    const status = pick(rng, STATUSES)
    const failed = status === 'retrying' || status === 'permanently_failed'
    return {
      id: id('whd', i + 1),
      endpointId: ep.id,
      endpointUrl: ep.url,
      eventType: pick(rng, ep.events),
      status,
      responseCode: status === 'delivered' ? 200 : failed ? pick(rng, [500, 503, 504, 429]) : null,
      attemptCount:
        status === 'permanently_failed' ? 5 : status === 'retrying' ? Math.floor(rng() * 3) + 2 : 1,
      durationMs: status !== 'pending' ? Math.floor(rng() * 1200) + 80 : null,
      createdAt: daysAgo(Math.floor(rng() * 7), Math.floor(rng() * 24)),
      lastError: failed ? pick(rng, ERRORS) : null,
    }
  })
  .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
