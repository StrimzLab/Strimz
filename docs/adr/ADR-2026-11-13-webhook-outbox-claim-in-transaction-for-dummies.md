# ADR for Dummies: A restart can never lose a merchant's webhook

- **Status:** Approved by the maintainer on 2026-11-13, with the recommended choices
- **Date:** 2026-11-13

## The Idea

When something happens, like a payment landing, Strimz writes a note saying "tell the
merchant". Every few seconds the scheduler picks up a batch of up to 100 notes, marks them
"taken", and then sends each one.

If the scheduler stops right after marking a batch "taken" and before sending it, those
notes are lost. Nobody ever looks at a "taken" note again. A stop like that happens on
every deploy, on a crash, or when a server is replaced. We proved it by killing the
scheduler at that exact moment: the payment's webhook was never sent, even after the
scheduler came back.

The fix: the scheduler marks a note "taken" and gets it ready to send in one step that
either fully happens or doesn't happen at all. If the scheduler dies in the middle, the
note stays untaken and the next run picks it up.

## What the Person Sees

- **Merchants:** they stop missing webhooks after Strimz deploys. At worst, a webhook
  arrives up to two minutes late.
- **The maintainer:** one database command to run once after the fix ships, which sends the
  webhooks that were already lost this way.

## Important Limitation

- Webhooks already lost before the fix are only sent if the maintainer runs the one-time
  command. Some may then arrive very late.
- The command must run only after the update is fully out. Run while an old scheduler is
  still working, it could send one webhook twice.
- The maintainer first counts the lost webhooks and sees how old they are, and can choose
  to send only recent ones, for example from the last week.

## What Changes

- How the scheduler picks up and prepares webhooks.

## What Does Not Change

- The webhooks themselves, their content and their signatures.
- The database layout, the API, the SDK and the contracts.

## Choices for the maintainer

- **W1.** One step per webhook, so a crash leaves it untaken. Recommended.
- **W2.** Send to the queue only after that step, and let the existing two-minute recovery
  catch a crash in between. Recommended.
- **W3.** Run the one-time command after deploy to send webhooks already stranded.
  Recommended; or skip it if late webhooks would confuse merchants more than missing ones.
