---
date: 2026-10-03
feature: Webhook delivery checks the target address at send time and no longer follows redirects
scope: fix
scenario-impact: needs_automation
---

# Webhooks: SSRF checks at send time, no redirects

The scheduler now resolves a webhook endpoint's hostname on every delivery, refuses it
if any address is private or reserved, and connects to the address it checked. It no
longer follows redirects. The API's check at endpoint creation covers the same address
ranges.

Closes #131.

## What was wrong

- The scheduler posted to the endpoint URL with `fetch`, which followed redirects and
  did not check the address it connected to. A merchant could register a public URL and
  later point its DNS at an internal address, or answer with a redirect to one, and the
  scheduler would send the request there. Up to 4,000 characters of the response were
  stored on the delivery and shown to the merchant.
- The API's creation-time check missed `198.18.0.0/15`, `192.0.0.0/24`, multicast,
  `240.0.0.0/4`, IPv4-mapped IPv6 addresses such as `::ffff:127.0.0.1`, NAT64, and
  other reserved ranges.

## What shipped

- One blocked-address list, built on `node:net` `BlockList`, in
  `apps/scheduler/src/infra/webhook-transport/blocked-addresses.ts` and an identical
  copy in `apps/api/src/modules/webhooks/blocked-addresses.ts`. IPv4: `0/8`, `10/8`,
  `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`,
  `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`. IPv6:
  `::/96`, `64:ff9b::/96`, `64:ff9b:1::/48`, `100::/64`, `2001:db8::/32`, `fc00::/7`,
  `fe80::/10`, `ff00::/8`. IPv4-mapped IPv6 addresses are checked against the IPv4 list.
- The scheduler sends through a new `WebhookTransport`. It resolves the hostname, refuses
  the delivery if any resolved address is blocked, and connects to the first address
  through a pinned `lookup`, so a second DNS answer cannot change the target. The URL
  hostname is kept, so TLS SNI and certificate checks are unchanged.
- Redirects are not followed. A `3xx` response is recorded with its status code and
  retried like any other failed attempt.
- A refused address is recorded as a failed attempt with `lastError`
  `webhook target <host> resolves to blocked address <ip>` and retried, so a DNS fix on
  the merchant's side recovers on the next attempt.
- The response body kept on the delivery is still capped at 4,000 characters. The
  scheduler stops reading the response after 16,000 bytes.
- The API rejects bracketed IPv6 literals by their address instead of failing DNS on
  the brackets.

## Not changed

- No migration, no BullMQ payload change, no webhook payload change, no published
  package change. `WebhookDelivery.responseBody` keeps its shape and limit; it now only
  holds responses from public addresses.

## Deploy

Deploy the scheduler and the API. No configuration change. Merchants whose endpoint
answers with a redirect will see failed deliveries with a `3xx` code and must update the
endpoint URL to the final address.
