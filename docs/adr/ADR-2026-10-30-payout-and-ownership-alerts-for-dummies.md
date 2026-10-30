# ADR for Dummies: Tell the merchant straight away when someone changes where their money goes

- **Status:** Accepted 2026-10-30
- **Date:** 2026-10-30

## The Idea

A merchant can change the wallet their money goes to, or hand their account to a new wallet. Both changes wait 24 hours before they take effect, so a mistake or an attack can be stopped.

That wait only helps if someone notices. Today nobody is told.

## The Fix

- **The merchant gets an email** as soon as a payout change or an ownership hand-over starts. It says what is changing, when it takes effect, and how to stop it if they didn't do it.
- **Strimz gets an alert** too, in the same alert email as other important contract events.
- **A new checklist** tells the team exactly what to do when an unexpected alert arrives.

## What People See

- **Merchants:** an email like "Your payout address is changing to 0x… on 31 October at 14:00. If this wasn't you, cancel it now." It has a button to the settings page where they can cancel.
- **Merchants handing over ownership:** the same kind of email. Until the dashboard gets a cancel button for this, it tells them to contact support.
- **The Strimz team:** an alert for each of these changes.

## Important Limitation

- **Merchants who make the change themselves also get the email.** It's worded so it makes sense either way.
- **Ownership hand-overs can't be cancelled from the dashboard yet.** We're logging that as a separate improvement.

## What Does Not Change

- The contracts.
- The 24-hour wait.
- How merchants change their payout address or owner.
