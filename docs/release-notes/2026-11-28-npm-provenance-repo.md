---
date: 2026-11-28
feature: npm accepts the published packages' provenance again
scope: fix
scenario-impact: none
---

# npm accepts the published packages' provenance again

The release after #591 failed for all five published packages. npm checks that a package's `repository.url` matches the repository whose workflow published it (its provenance), and #591 had pointed `repository` at the public mirror `StrimzLab/strimz-sdk`. Nothing was published.

- `repository` names `StrimzLab/strimz` again, with each package's `directory`.
- `homepage` still sends readers to the public mirror.
- A test in `packages/mirror` checks both for all five packages.
- No new changeset: the versions bumped in #592 never reached npm, so the next Release run publishes them.
