# ADR for Dummies: Ask for transactions between two dates

- **Status:** Accepted 2026-10-21
- **Date:** 2026-10-21

## The Problem

Our developer toolkit (the SDK) lets a merchant write "give me my transactions from 1 October to 1 November". But our server doesn't understand those two dates. It answers with an error, so the toolkit promises something that doesn't work. The AutoPay Agent's activity list has the same problem.

## What We'll Do

- **Teach the server the two dates,** for transactions and for agent activity.
- **The start date counts and the end date doesn't.** "1 October to 1 November" means all of October, with nothing from November and nothing counted twice.
- **Dates must include a time and a time zone,** for example `2026-10-01T00:00:00Z`. Without a time zone, "midnight" is a different moment in Lagos and in London, so the server refuses to guess.
- **For transactions, the date is when the payment landed on the blockchain,** which is the same order the list already uses.
- **We add a small database index** so date lookups stay fast as the table grows.

## What Merchants Get

They can pull exactly one month (or week, or day) of payments for their books, page by page.

## What Does Not Change

- The other lists.
- What comes back from any list.
- Payments, contracts, webhooks.
