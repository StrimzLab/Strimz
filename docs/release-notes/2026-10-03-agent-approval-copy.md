---
date: 2026-10-03
feature: Agent job approval text describes what approval does
scope: fix
scenario-impact: none
---

# Agent job approval text

The agent job page told merchants that approving a job releases escrow to the vendor and
needs their signature. Approval actually funds an on-chain escrow that Strimz signs; the
vendor is paid only when the job is released. The text now says so. The confirmation
dialog added in #195 already described this correctly.

Closes #199.
