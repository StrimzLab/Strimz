# ADR for Dummies: A list of who the Strimz website may talk to

- **Status:** Proposed, awaiting maintainer approval
- **Date:** 2026-10-03

## The Idea

Browsers can be told, through a header called a Content-Security-Policy, exactly which
other websites a page may load code and images from. If an attacker manages to sneak
code into a Strimz page, that list stops it from loading more code or sending data
away. We propose to write that list, first in a "watch only" mode that reports
problems without blocking anything, and to switch it on fully once the reports are
clean.

## What the Person Sees

1. Nothing changes for merchants or payers while the list is in watch-only mode.
2. If the list is missing a service Strimz really uses (for example the login provider
   or a wallet connector), a report is sent to us instead of the page breaking.
3. Once the reports are clean, the list is enforced, and the browser refuses anything
   not on it.

## Important Limitation

The checkout page must stay embeddable on merchants' own websites, because the Strimz
React SDK shows checkout inside the merchant's page. Until each merchant can register
the websites allowed to embed their checkout, any website can embed it.

## What Changes

- A new watch-only header on every page of strimz.finance.
- A place to collect the reports (to be chosen).
- Later, the same header switched from watch-only to enforced.

## What Does Not Change

- Login, checkout, payments and the dashboard work the same.
- The security headers already shipped with issue #132 stay as they are.
