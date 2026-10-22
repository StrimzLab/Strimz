---
date: 2026-10-22
feature: "Who it's for" section on the homepage
scope: feat
scenario-impact: none
---

# "Who it's for" section on the homepage

Closes #273.

## What shipped

- **Who it's for:** under the hero, five tabs (SaaS, Marketplaces, Creators, Agencies, Global B2B) replace the scrolling "Built for" chips. Each tab shows the problem that kind of business has, what Strimz does about it, the matching picture from the use-cases page, and a link to that story at `/use-cases#<id>`.
- **One list:** the problem and fix for each audience live in `use-cases/data.ts`, next to the rest of the use-case content the nav and use-cases page already read.
- **Motion:** the section rises in once on scroll, and switching tabs cross-fades the panel. With reduced motion, both are instant.
- **Marquee removed:** `fx/marquee.tsx` and its CSS are gone, since nothing else used them.

## Not changed

- The use-cases page. Its mock lookup moved into `use-cases/mock-map.ts`, and it renders the same.
