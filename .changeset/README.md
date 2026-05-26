# Changesets

This directory is where [Changesets](https://github.com/changesets/changesets)
keeps its config and per-PR changelog entries.

## Adding a changeset

When you make a change that ships to npm — fix, feature, breaking
change — record it before pushing:

```sh
pnpm changeset
```

Pick the affected package(s), choose the bump type (`patch` / `minor` /
`major`), and write a one-line summary. The CLI drops a markdown file
into `.changeset/`. Commit it alongside your code changes.

## What happens on merge

When a PR with a changeset lands on `main`, the release workflow
(`.github/workflows/release.yml`) opens or updates a **"Version Packages"**
PR that consumes the changesets, bumps versions, regenerates each
package's `CHANGELOG.md`, and re-writes any `workspace:*` deps.

Merging that PR triggers the workflow again and publishes the new
versions to npm with provenance.

## Which packages are tracked

Five packages are publishable:

- `@strimz/shared-config`
- `@strimz/shared-crypto`
- `@strimz/shared-types`
- `@strimz/sdk`
- `@strimz/sdk-react`

Everything else (`apps/*`, `packages/contracts`, `packages/db`,
`packages/ui`, `packages/tsconfig`, `packages/eslint-config`) is in the
`ignore` list of `.changeset/config.json` and never publishes.
