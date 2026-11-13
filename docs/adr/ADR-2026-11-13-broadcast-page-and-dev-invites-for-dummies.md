# ADR for Dummies: Reading admin announcements, and testing admin invites without email

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

When Strimz admins send an announcement, merchants see it in their notification bell. Clicking it today leads to a "page not found". This adds the missing page, where a merchant can read the whole announcement, links and formatting included. Strimz cleans the message first, so nothing harmful can run in the merchant's browser.

Separately, inviting a new admin only works through an email link. On a developer's machine, where no email is sent, the invite can't be accepted. Outside the live site, the invite screen will now show the link directly.

## What the Person Sees

1. A merchant clicks an announcement in the bell menu.
2. A page opens with the title, when it was sent, and the full message.
3. Clicking other notifications, such as a payment, a subscription or a refund, opens the right list and briefly outlines that row.
4. On a test or local setup, an admin who invites someone sees "Invite link" with a copy button. On the live site this never appears; the link only goes by email.

## Important Limitation

The announcement email keeps its current, simpler cleaning. That's acceptable because email apps strip risky content themselves. Moving the email onto the same cleaner is a follow-up.

## What Changes

- New page for reading an announcement, in light and dark themes.
- Notification links now point at the exact row.
- Invite links are visible outside the live site.
- The example config lists the dashboard address the invite link uses.

## What Does Not Change

- The live site's invite process: the link still only goes by email.
- How admins write announcements.
- Payments, the database, the contracts and webhooks.
