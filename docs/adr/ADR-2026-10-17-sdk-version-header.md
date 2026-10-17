# ADR: Set the SDK version header from package.json at build time

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #296
- **Scope:** `packages/sdk` only (build config, test config, `src/http/headers.ts`). No API, web or
  other package changes.

## Context

Checked against `main` at `3b52e35`.

1. `SDK_VERSION` is the literal `'0.0.0'` (`packages/sdk/src/http/headers.ts:22`). Its comment says
   the build pipeline updates it, but nothing does. `buildBaseHeaders` sends it as
   `X-Strimz-Sdk-Version` from both `StrimzClient` and `StrimzBrowserClient`, so every published
   version (now 0.11.0) reports `0.0.0`.
2. Changesets bumps `packages/sdk/package.json` `version` and then the release workflow builds and
   publishes. `package.json` is the only place the real version lives.
3. The SDK is built with tsup (esbuild) and tested with vitest against `src`. Consumers get `dist`:
   the `exports` map lists only `dist` files, so `src` (shipped for source maps) can't be imported.
4. `tsconfig.json` has `rootDir: "src"`, so importing `../../package.json` from `src` fails
   `tsc --noEmit` (TS6059) and would put the whole `package.json` into the bundle's reach.

## Decision

1. `tsup.config.ts` reads `package.json` and sets
   `define: { __SDK_VERSION__: JSON.stringify(pkg.version) }`. esbuild replaces the identifier with
   the string literal in every entry (`index`, `browser-client`, ...), ESM and CJS.
2. `vitest.config.ts` sets the same `define`, so tests run the code the way it ships.
3. `src/http/headers.ts`: `export const SDK_VERSION: string = __SDK_VERSION__`, with an ambient
   `declare const __SDK_VERSION__: string` in `src/build-env.d.ts`. The stale comment becomes
   "Set from package.json at build time."
4. Patch changeset for `@strimz/sdk`.

## Diagram

```
changeset version ─► package.json "version": "0.11.1"
                              │
              tsup / vitest define __SDK_VERSION__ = "0.11.1"
                              │
dist/*.js  SDK_VERSION = "0.11.1" ─► X-Strimz-Sdk-Version: 0.11.1
```

## Consequences

- The header is right for every future release with no manual step.
- Anything that bundles the SDK's `src` itself (not possible through the `exports` map) would need
  the same define. Accepted.
- Already-published versions keep sending `0.0.0`; the API should read `0.0.0` as "0.11.0 or
  older". Nothing in the API reads the header today besides CORS.

## Alternatives considered

- **Import `package.json` from `src`.** Breaks `rootDir`, and needs `resolveJsonModule` plus care
  that esbuild drops the rest of the file. More moving parts than a define.
- **Generate `src/version.ts` in a prebuild script.** A generated file that's either committed
  (drifts when someone forgets to run it) or gitignored (typecheck fails on a fresh clone).
- **Bump the literal in the changeset release step.** One more script in the release workflow that
  can be skipped.

## Verification (red first)

1. `packages/sdk/tests/client.test.ts`: `StrimzClient` and `StrimzBrowserClient` send
   `X-Strimz-Sdk-Version` equal to `package.json` `version`. Red today: they send `0.0.0`.
2. `packages/sdk/tests/build-config.test.ts`: the tsup config's `define.__SDK_VERSION__` is
   `JSON.stringify(pkg.version)`, so the published build can't miss it while tests pass.
3. After `pnpm --filter @strimz/sdk build`, `dist/index.js`, `dist/index.cjs` and
   `dist/browser-client.js` contain the version string and no `__SDK_VERSION__`.
