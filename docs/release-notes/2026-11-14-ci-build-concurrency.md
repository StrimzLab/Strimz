---
date: 2026-11-14
feature: CI builds at most two workspaces at once
scope: chore
scenario-impact: none
---

# CI build concurrency

Since the web app became five Next.js apps, the `node` job's build step was sometimes cancelled partway through: turbo ran up to ten builds at once, and six Next.js builds with 4 GB heaps each ran the runner out of memory. The step now runs `turbo run build --concurrency=2`. No app code changes.
