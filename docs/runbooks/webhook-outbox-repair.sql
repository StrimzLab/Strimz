-- Once, after every scheduler runs the 2026-11-13 outbox fix: release events a scheduler
-- claimed and died on before hydrating them. See webhook-outbox-repair.md.
-- Set strimz.repair_max_age (e.g. '7 days') first to release only events that recent.
UPDATE "WebhookEvent" e SET "dispatchedAt" = NULL
 WHERE e."dispatchedAt" IS NOT NULL AND e."dispatchError" IS NULL
   AND e.payload ? 'ref'
   AND NOT EXISTS (SELECT 1 FROM "WebhookDelivery" d WHERE d."eventId" = e.id)
   AND e."createdAt" >= COALESCE(
         now() - NULLIF(current_setting('strimz.repair_max_age', true), '')::interval,
         '-infinity'::timestamptz);
