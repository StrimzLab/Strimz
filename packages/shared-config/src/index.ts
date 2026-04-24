/**
 * @strimz/shared-config
 *
 * Single source of truth for chain definitions, token registry, fee tiers,
 * webhook event names, API key conventions, agent flags, and CCTP addresses.
 *
 * Every other Strimz TypeScript package and app reads these constants from
 * here. Do not duplicate values; import them.
 */

export * from './chains.js'
export * from './tokens.js'
export * from './tiers.js'
export * from './webhooks.js'
export * from './api-keys.js'
export * from './agents.js'
export * from './cctp.js'
