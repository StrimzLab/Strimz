# ADR for Dummies: The SDK tells Strimz its real version

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

Every request a merchant's code makes through the Strimz SDK carries a label saying which SDK
version sent it. That label has always said "0.0.0", whatever version was installed. From now on
the label is filled in automatically when the SDK is built, from the same version number npm shows.

## What the Person Sees

1. A developer installs the next `@strimz/sdk` release.
2. Their requests to Strimz now say which version they came from.
3. When they report a problem, Strimz can see which SDK version they run.

## Important Limitation

- Versions already published keep saying "0.0.0". Only releases after this change report correctly.

## What Changes

- The SDK's build sets the version label from its own version number.
- The SDK gets a patch release.

## What Does Not Change

- How merchants call the SDK, and every request and response.
- The API, the dashboard and the other packages.
