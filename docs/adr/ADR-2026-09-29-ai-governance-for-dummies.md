# ADR for Dummies: AI governance and engineering standards

- **Status:** Proposed, awaiting maintainer approval
- **Date:** 2026-09-29

## The Idea

Everyone who changes Strimz, people and AI agents alike, follows one written rulebook.
A human approves every significant change before work starts, and the computer checks
the work automatically before it can reach `main`.

## What the Person Sees

1. A developer or agent picks up a task and reads `AGENTS.md`.
2. For anything bigger than a small fix, they write two short decision documents, one
   technical and one plain-English like this one, and wait for the maintainer to say
   yes.
3. They work in a separate copy of the code, so nothing touches `main` directly.
4. Bugs are fixed by first writing a test that proves the bug, then fixing it.
5. When they push, their machine runs the checks. If anything fails, the push stops.
6. They open a pull request from a checklist template, with a short release note.
7. GitHub runs the same checks and shows one green `quality` tick when everything
   passes.

## Important Limitation

The code currently has about 600 minor style warnings. The rule is "zero warnings",
but switching that on today would block everyone. A separate cleanup change removes
those warnings and then turns the rule on. Until then, warnings are allowed but errors
are not.

## What Changes

- New rulebook (`AGENTS.md`) and a standards guide for the code.
- A single command, `./scripts/preflight.sh`, that checks formatting, code quality,
  types, tests, and builds.
- Pushing code now runs those checks automatically.
- Pull requests use a checklist and must include a release note when app code changes.
- A new `quality` check on GitHub that sums up every other check.
- A `docs/` folder for decisions, plans, release notes, and test scenarios.

## What Does Not Change

- No feature, screen, API, contract, or database changes.
- Deployments work exactly as before.
- Existing GitHub checks keep their names, so nothing in flight gets stuck.
