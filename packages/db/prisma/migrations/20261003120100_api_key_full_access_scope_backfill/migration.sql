UPDATE "MerchantApiKey"
SET "scopes" = "scopes" || ARRAY['merchants_read', 'customers_read', 'customers_write', 'analytics_read']::"ApiKeyScope"[]
WHERE "revokedAt" IS NULL
  AND "scopes" @> ARRAY[
    'sessions_read',
    'sessions_write',
    'subscriptions_read',
    'subscriptions_write',
    'refunds_read',
    'refunds_write',
    'transactions_read',
    'webhooks_read',
    'webhooks_write',
    'invoices_read',
    'invoices_write',
    'storefronts_read',
    'storefronts_write',
    'agents_read',
    'agents_write',
    'relay_read',
    'relay_write',
    'api_keys_read',
    'api_keys_write'
  ]::"ApiKeyScope"[];
