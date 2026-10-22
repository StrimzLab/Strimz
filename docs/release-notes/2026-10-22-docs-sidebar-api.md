---
date: 2026-10-22
feature: Docs sidebar names the endpoint list and the API reference apart
scope: fix
scenario-impact: none
---

# One "API Reference" in the docs sidebar

Closes #335.

## What shipped

- **Rename:** the single-page list of every endpoint (`/docs/api-reference`) is now called **Endpoint list** in the sidebar, the page title and the browser tab. The `api` folder of per-resource pages keeps the name **API Reference**.
- **One title:** the endpoint list page showed its title twice. It now shows it once.
- **Description:** the page's description no longer says it is generated from the OpenAPI spec. It is written by hand and links to the spec.
- **Links:** the two links that called this page "API reference" (idempotency and dashboard transactions) now say "endpoint list".
- **Guard:** a test checks that every top-level sidebar entry has its own name.

## Not changed

- The URL `/docs/api-reference` and its anchors, so existing links keep working.
- Four other pages that show their title twice. They are tracked in #345.
