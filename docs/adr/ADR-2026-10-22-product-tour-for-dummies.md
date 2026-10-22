# ADR for Dummies: A tour of the dashboard on the homepage

- **Status:** Accepted 2026-10-22
- **Date:** 2026-10-22

## The Idea

The homepage never shows the dashboard a merchant actually uses. We add a short animated tour of it, so a visitor can see what setting up and getting paid looks like.

## What the Person Sees

1. Below "How it works", a section called "See it in your dashboard".
2. On the left, three short steps: create a plan, copy its sign-up link, watch payments arrive.
3. On the right, a window that looks like the Strimz dashboard. When it scrolls into view, a pointer:
   - clicks **New plan**, types "Team" and "80.00", and creates the plan;
   - copies the plan's sign-up link, and a "copied" message pops up;
   - goes to **Home**, where a payment of 80 USDC appears and monthly recurring revenue goes up.
4. The view gently zooms in on each click, the way screen-recording tools do.
5. The step on the left lights up as the pointer does it.
6. A **Replay** button plays it again.
7. People who turned off animations see the finished screen straight away.

## What Changes

- The homepage has one new section, after "How it works".

## What Does Not Change

- The dashboard itself.
- No "Sample", "Demo" or "Live" labels, no network name, and no made-up customers or numbers presented as real.
- The light/dark switch works on the tour too.
