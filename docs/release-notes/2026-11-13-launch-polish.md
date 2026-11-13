---
date: 2026-11-13
feature: Admin audit log, UTC database sessions, Brotli RPC replies, and four smaller launch fixes
scope: fix
scenario-impact: none
---

# Launch polish

Six launch issues in one change.

## Admin audit log (#260)

New admin page, **Audit log**, backed by `GET /v1/admin/audit-log`. See `docs/adr/ADR-2026-11-13-admin-audit-log.md`.

- It lists every `AuditLog` row newest first: admin actions from the API, and on-chain events recorded by the indexer.
- Filters: category, source (on-chain or admin action), and date. The API also accepts `action`, `targetType`, `targetId` and `merchantId`.
- On-chain rows link to the transaction on the explorer. Alerting rows show whether the email has gone out ("Alert pending" or "Alert emailed").
- Only `super_admin` and `admin` can see it, because rows include admins' IP addresses. `read_only` admins don't get the nav item, and the route returns 403 for them.

## All database sessions run in UTC (#419)

Prisma stores UTC in `timestamp without time zone` columns. Raw SQL that compared them with `NOW()` was off by the server's offset whenever Postgres wasn't set to UTC. For example, on a UTC+1 machine:

- invoices went overdue an hour early;
- subscriptions lapsed early;
- admin and analytics 30-day windows drifted;
- indexer writes landed an hour off.

Every connection now runs with `TimeZone=UTC`: the shared Prisma client used by the API, scheduler and agent, and the indexer's pgx pool. This fixes every `NOW()` comparison at once, without rewriting each query. Rows already written with a skewed `NOW()` on a non-UTC machine stay as they are.

## The indexer reads Brotli RPC replies (#411)

Blockdaemon answers with `Content-Encoding: br` whatever the client asks for, and Go's HTTP client only decodes gzip. So the indexer dropped that endpoint at startup ("invalid character '\x1b'"). A small transport now decodes Brotli replies (`github.com/andybalholm/brotli`). Checked live against `rpc.blockdaemon.testnet.arc.io`.

## Broadcast emails include the message (#443)

The broadcast email passed its body to a react-email `Section` with `dangerouslySetInnerHTML`, which React refuses alongside children. So emails went out without the message itself. The body now renders inside a plain `div`.

The API cleans it first with the same `sanitize-html` allowlist as the dashboard broadcast page, and the template's regex cleaner is gone. The email preview line is plain text instead of raw HTML.

## Smaller fixes

- **#397:** the ownership hand-over email now points to Settings, On-chain policy, with a "Review and cancel" button, like the payout email. It no longer asks merchants to email support.
- **#441:** failed refunds show their reason under the status on the refunds page, and the CSV export has a "Failure reason" column.
