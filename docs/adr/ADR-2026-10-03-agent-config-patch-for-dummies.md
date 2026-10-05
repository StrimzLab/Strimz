# ADR for Dummies: Changing one agent setting stops resetting the others

- **Status:** Accepted 2026-10-04
- **Date:** 2026-10-03

## The Idea

The AutoPay Agent has three groups of settings: recovery, cashflow and commerce. Today,
if you change one setting in a group through the API, every other setting in that group
quietly goes back to its factory value. You also cannot empty the recovery message or
remove the monthly spending cap once you have set them. We make an update change only
what you sent, and let you empty those two settings by sending an empty value.

## What the Person Sees

1. A merchant has a commerce vendor allowlist of two vendors, a $200 approval threshold
   and a $5,000 monthly spending cap.
2. A developer raises the spending cap to $7,500 through the API.
3. Today, the cap goes up, but the allowlist is emptied, which means any vendor is
   allowed, and the approval threshold jumps back to $1,000. Nothing warns anyone.
4. After this change, the cap goes up and the allowlist and threshold stay exactly as
   they were.
5. In the dashboard, a merchant empties the recovery message field and saves. Today the
   old message stays. After this change it is removed and the agent uses the default
   wording.

## Important Limitation

We cannot find the merchants whose settings were already reset. A reset setting looks
exactly like a merchant who picked the factory value, and Strimz keeps no history of
setting changes. The release note asks merchants who changed agent settings through the
API or SDK to check them, especially the commerce vendor allowlist and approval
threshold.

## What Changes

- Updating agent settings changes only the fields in the request.
- The recovery message and the monthly spending cap can be emptied.
- Sending an empty value for any other setting is still refused.
- Developers using the SDK can send just the one field they want to change in any group.
- New versions of the `@strimz/shared-types` and `@strimz/sdk` packages. Code that read
  the server-side "parsed update" type may need small edits; ordinary SDK calls do not.

## What Does Not Change

- The settings themselves, their factory values and how the agent uses them.
- The dashboard screens.
- The database: no migration.
- Reading the settings: the response looks the same.
- Older SDK versions: they get the fix as soon as the API is deployed.
