-- Link transactions recorded before the indexer copied the customer.
-- Idempotent: only fills rows that are still NULL.
UPDATE "Transaction" t
   SET "customerId" = p."customerId"
  FROM "PaymentSession" p
 WHERE t."customerId" IS NULL
   AND t."sessionId" = p.id
   AND p."customerId" IS NOT NULL;

UPDATE "Transaction" t
   SET "customerId" = s."customerId"
  FROM "Subscription" s
 WHERE t."customerId" IS NULL
   AND t."subscriptionId" = s.id;
