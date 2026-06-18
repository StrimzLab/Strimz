Ready to boot apps.

Updated end-to-end testing guide

Prerequisites (one-time setup)

If Postgres or Redis ever stop, restart them:

brew services start postgresql@18
brew services start redis

To restore a clean DB from a previous session's data:

/opt/homebrew/opt/postgresql@18/bin/psql -d postgres <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='strimz' AND pid <> pg_backend_pid();
DROP DATABASE strimz;
CREATE DATABASE strimz;
SQL
cd /Users/MAC/Documents/Strimz/strimz
pnpm --filter @strimz/db db:migrate:deploy

If apps are stuck in a weird state from a previous session:

pkill -9 -f 'Strimz/strimz/apps/(api|scheduler|agent|web)' 2>/dev/null

Boot the apps — four shell tabs

Tab 1 — apps/api at :4000

cd /Users/MAC/Documents/Strimz/strimz
pnpm --filter @strimz/api dev

# Watch for:

# "Strimz API listening on 4000 (development) — docs at /docs"

# "Mapped {/v1/admin/\*} (AdminController)"

Tab 2 — apps/scheduler at :4200

cd /Users/MAC/Documents/Strimz/strimz
pnpm --filter @strimz/scheduler dev

# Watch for: "Strimz scheduler listening on 4200 (development)"

# Every 30s: "merchant-notifications: welcome=N payment=N sub_started=N sub_charged=N"

Tab 3 — apps/agent at :4300 (optional — only if you want to test recovery emails, cashflow digests, etc.)

cd /Users/MAC/Documents/Strimz/strimz
pnpm --filter @strimz/agent dev

# Watch for: "Strimz agent listening on 4300 (development)"

Tab 4 — apps/web at :3000

cd /Users/MAC/Documents/Strimz/strimz
pnpm --filter @strimz/web dev

# If it exits cleanly without an error, fall back to:

# cd apps/web && pnpm next dev --port 3000

Browser flow

1. http://localhost:3000/ → marketing landing.
2. /signup → sign in with the Privy-allowlisted email. After /v1/auth/sync returns, you land on /app as a fresh merchant.
3. Merchant flow:
   - /app/api-keys → Create key → name it "Local test", pick secret + test → copy the sk*test*... value shown once.
   - /app/payment-sessions → Create session → 50 USDC → copy checkoutUrl.
   - Open the checkoutUrl in a new tab → connect a wallet that holds Arc Testnet USDC → sign the EIP-3009 prompt.
   - Back in /app/payment-sessions: the row flips to confirmed within ~3 seconds (Arc finalises in ~13s; indexer picks up the PaymentSettled event shortly after).
   - Tab 2 (scheduler) logs merchant-notifications: payment=1; receipt email lands at strimztokenstream@gmail.com via Resend.
   - /app/webhooks → add an endpoint at https://webhook.site/<your-uuid> → trigger another session and watch the delivery.

4. Admin flow:
   - http://localhost:3000/admin → AdminAuthGuard email-matches you against the bootstrap row, claims your Privy user, drops you in as super_admin.
   - Click through /admin overview, /admin/merchants, /admin/analytics, /admin/health.
   - /admin/admins → Invite admin with a real email → check that inbox in ~5s.
   - Open the merchant detail page → change tier → toast confirms, DB row updates, audit row written.

Sign of life if something's off

- Tab 1 (api) logs Mapped {/v1/admin/\*} → admin endpoints mounted.
- Tab 2 (scheduler) logs merchant-notifications: welcome=N ... every 30s → cron loop alive.
- Browser DevTools → Network on dashboard pages: calls go to localhost:4000/v1/... and return 200.
  - Back in /app/payment-sessions: the row flips to confirmed within ~3 seconds (Arc finalises in ~13s; indexer picks up the PaymentSettled event shortly after).
  - Tab 2 (scheduler) logs merchant-notifications: payment=1; receipt email lands at strimztokenstream@gmail.com via Resend.
  - /app/webhooks → add an endpoint at https://webhook.site/<your-uuid> → trigger another session and watch the delivery.

4. Admin flow:
   - http://localhost:3000/admin → AdminAuthGuard email-matches you against the bootstrap row, claims your Privy user, drops you in as super_admin.
   - Click through /admin overview, /admin/merchants, /admin/analytics, /admin/health.
   - /admin/admins → Invite admin with a real email → check that inbox in ~5s.
   - Open the merchant detail page → change tier → toast confirms, DB row updates, audit row written.

Sign of life if something's off

- Tab 1 (api) logs Mapped {/v1/admin/\*} → admin endpoints mounted.
- Tab 2 (scheduler) logs merchant-notifications: welcome=N ... every 30s → cron loop alive.
- Browser DevTools → Network on dashboard pages: calls go to localhost:4000/v1/... and return 200.
- /admin shows "Not authorized" after signing in → your Privy email doesn't match emmanuelomemgboji@gmail.com. Fix:
  /opt/homebrew/opt/postgresql@18/bin/psql -d strimz \
   -c "UPDATE \"AdminUser\" SET email='your-actual-privy-email@gmail.com' WHERE id='adm_bootstrap_emmanuel';"
- Anything 4xx in the browser → check Tab 1 first. Errors surface there as readable codes (invalid_state, not_found, etc.).
- API or scheduler fails to start with P1000: Authentication failed → Homebrew Postgres stopped. brew services start postgresql@18.
- API or scheduler fails to start with ECONNREFUSED ::1:6379 → Redis stopped. brew services start redis.

That's the lap. Tabs 1, 2, and 4 are the minimum to exercise the merchant + admin flows. Tab 3 (agent) is for testing agent capabilities specifically.
