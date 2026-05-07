/**
 * Ambient module declarations for Prisma 7 runtime internals.
 *
 * Prisma's generated client deep-imports a couple of wasm-glue modules
 * from `@prisma/client/runtime/...` that don't ship `.d.ts` files —
 * they're internal Postgres query-compiler WASM bindings, not part of
 * the public API. Without these shims, tsc fails with TS7016 when we
 * compile the generated client. Declaring them with the default `any`
 * shape is the standard pattern for untyped first-party deep imports.
 */

declare module '@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs'
declare module '@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs'
