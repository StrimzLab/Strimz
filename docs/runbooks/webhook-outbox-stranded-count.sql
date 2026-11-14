-- Read only. Counts events a scheduler claimed and died on before hydrating them,
-- the ones webhook-outbox-repair.sql would release. See webhook-outbox-repair.md.
SELECT e.type::text AS type, e.mode::text AS mode, count(*) AS stranded,
       min(e."createdAt") AS oldest, max(e."createdAt") AS newest
  FROM "WebhookEvent" e
 WHERE e."dispatchedAt" IS NOT NULL AND e."dispatchError" IS NULL
   AND e.payload ? 'ref'
   AND NOT EXISTS (SELECT 1 FROM "WebhookDelivery" d WHERE d."eventId" = e.id)
 GROUP BY e.type, e.mode
 ORDER BY oldest;
