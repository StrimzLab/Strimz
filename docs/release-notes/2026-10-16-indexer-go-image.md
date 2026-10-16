---
date: 2026-10-16
feature: Indexer and Lightsail images build with Go 1.26, matching go.mod
scope: fix
scenario-impact: none
---

# Go 1.26 build images

Fixes #301.

## What shipped

- `apps/indexer/Dockerfile` and `Dockerfile.lightsail` build the indexer on `golang:1.26-alpine`.
- The Dependabot bumps in #87, #89 and #90 raised `go.mod` to `go 1.26.0`, and `go mod download` failed on the 1.25 image.

## Operator steps

None. The next Lightsail deploy picks it up.

## Verification

- **Red:** on `6f1e9b7`, `docker build -f apps/indexer/Dockerfile apps/indexer` failed with `go.mod requires go >= 1.26.0 (running go 1.25.14)`.
- **Green:** the indexer image and the full Lightsail image both build.
