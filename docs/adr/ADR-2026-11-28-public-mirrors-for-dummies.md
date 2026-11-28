# Public copies of parts of Strimz (plain English)

- **Status:** Accepted 2026-11-28 by the founder
- **Date:** 2026-11-28
- **Technical version:** ADR-2026-11-28-public-mirrors

## The situation

All of Strimz's code lives in one private place. Developers want to read the code they install (the SDKs) and the smart contracts that move money, because being able to read them builds trust. The part that runs our servers must stay private.

## What we'll do

- **Keep one private home for everything,** so a change that touches several parts is still made and checked once.
- **Publish three public, read-only copies:**
  - **strimz-sdk:** the code developers install to use Strimz;
  - **strimz-contracts:** the smart contracts;
  - **strimz-web:** the website and the docs.

  Fanline, the demo, already has its own public home.

- **Keep them up to date automatically.** Each time a change is approved, a robot copies those folders to the public copies.
- **A safety check runs before every copy.**
  - It refuses to publish passwords, keys or private settings.
  - It refuses any wallet or contract address that isn't on an approved list of public ones, so private addresses can't slip out.
  - If anything looks wrong, nothing is published.
- **The public copies start fresh.** They don't carry the private history of how the code was written.

## What it costs

- Nothing in money for the copies themselves.
- Our private code checks already use more of GitHub's free monthly allowance than it gives private projects. We'll make the checks lighter so they fit.

## What you decided

1. The website and docs copy is public to read only, not to reuse.
2. No paying for GitHub: the code checks will be made lighter to fit the free monthly allowance.
