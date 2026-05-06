import { daysAgo, id, mulberry32, pick, range } from './_seed'

export type ApiKeyMode = 'live' | 'test'
export type ApiKeyStatus = 'active' | 'revoked'
export type ApiKeyScope =
  | 'sessions_read' | 'sessions_write'
  | 'subscriptions_read' | 'subscriptions_write'
  | 'customers_read' | 'customers_write'
  | 'refunds_read' | 'refunds_write'
  | 'invoices_read' | 'invoices_write'
  | 'webhooks_read' | 'webhooks_write'
  | 'transactions_read'
  | 'agents_read' | 'agents_write'
  | 'storefronts_read' | 'storefronts_write'
  | 'api_keys_read' | 'api_keys_write'

export const ALL_SCOPES: ApiKeyScope[] = [
  'sessions_read', 'sessions_write',
  'subscriptions_read', 'subscriptions_write',
  'customers_read', 'customers_write',
  'refunds_read', 'refunds_write',
  'invoices_read', 'invoices_write',
  'webhooks_read', 'webhooks_write',
  'transactions_read',
  'agents_read', 'agents_write',
  'storefronts_read', 'storefronts_write',
  'api_keys_read', 'api_keys_write',
]

export type ApiKey = {
  id: string
  name: string
  prefix: string
  mode: ApiKeyMode
  scopes: ApiKeyScope[]
  status: ApiKeyStatus
  createdAt: string
  lastUsedAt: string | null
  createdBy: string
}

const rng = mulberry32(53)

export const API_KEYS: ApiKey[] = [
  {
    id: id('ak', 1),
    name: 'Production server',
    prefix: 'sk_live_xS8aZ1',
    mode: 'live',
    scopes: ALL_SCOPES,
    status: 'active',
    createdAt: daysAgo(180),
    lastUsedAt: daysAgo(0, 11),
    createdBy: 'founder@strimz.finance',
  },
  {
    id: id('ak', 2),
    name: 'Production read-only (analytics worker)',
    prefix: 'sk_live_qP2nW9',
    mode: 'live',
    scopes: ['sessions_read', 'subscriptions_read', 'customers_read', 'transactions_read', 'invoices_read', 'webhooks_read'],
    status: 'active',
    createdAt: daysAgo(120),
    lastUsedAt: daysAgo(0, 8),
    createdBy: 'data@strimz.finance',
  },
  {
    id: id('ak', 3),
    name: 'Sandbox / preview deploy',
    prefix: 'sk_test_kT5fM7',
    mode: 'test',
    scopes: ALL_SCOPES,
    status: 'active',
    createdAt: daysAgo(45),
    lastUsedAt: daysAgo(2),
    createdBy: 'founder@strimz.finance',
  },
  {
    id: id('ak', 4),
    name: 'Webhooks micro-service',
    prefix: 'sk_live_yC3vL4',
    mode: 'live',
    scopes: ['webhooks_read', 'webhooks_write'],
    status: 'active',
    createdAt: daysAgo(60),
    lastUsedAt: daysAgo(0, 13),
    createdBy: 'founder@strimz.finance',
  },
  {
    id: id('ak', 5),
    name: 'Old CI integration (rotated)',
    prefix: 'sk_live_aF8bD2',
    mode: 'live',
    scopes: ['sessions_read', 'sessions_write'],
    status: 'revoked',
    createdAt: daysAgo(220),
    lastUsedAt: daysAgo(40),
    createdBy: 'founder@strimz.finance',
  },
]

void rng // satisfies linter; rng kept for future seeded extensions
void pick
void range
