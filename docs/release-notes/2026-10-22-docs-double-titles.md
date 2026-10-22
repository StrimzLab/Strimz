---
date: 2026-10-22
feature: Docs pages show their title once
scope: fix
scenario-impact: none
---

# Docs pages show their title once

Closes #345.

## What shipped

- **One title:** Getting Started, SDKs, Webhooks and Meta-tx flow showed their title twice at the top of the page. fumadocs already renders the frontmatter title as the page heading, so the extra `# ` heading in each file is removed.
- **Guard:** a test checks every docs page for a `# ` heading outside code blocks. It replaces the single-page check added for the endpoint list in #335.

## Not changed

- Page titles, URLs, anchors and the rest of each page.
