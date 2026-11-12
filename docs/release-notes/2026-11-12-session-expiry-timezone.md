---
date: 2026-11-12
feature: Payment links stay open until their expiry on any database time zone
scope: fix
scenario-impact: none
---

# Session expiry and the database time zone

On a Postgres server not set to UTC, the scheduler expired payment links early: a
30-minute link showed "expired" within a minute on a UTC+1 database.

The session-expiry job compared `expiresAt` with `NOW()`. Prisma stores UTC in a column
without a time zone, and Postgres reads that column in the server's time zone for the
comparison. The job now compares, and writes `updatedAt`, in UTC. Databases already on
UTC behaved correctly and are unchanged.
