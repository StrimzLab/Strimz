import type { AgentMerchantConfig, UpdateAgentConfigParsed } from '@strimz/shared-types'

export function mergeAgentConfig(
  stored: AgentMerchantConfig,
  patch: UpdateAgentConfigParsed,
): AgentMerchantConfig {
  return {
    ...stored,
    enabledCapabilities: patch.enabledCapabilities ?? stored.enabledCapabilities,
    recovery: overlay(stored.recovery, patch.recovery),
    cashflow: overlay(stored.cashflow, patch.cashflow),
    commerce: overlay(stored.commerce, patch.commerce),
  }
}

function overlay<T extends object>(stored: T, patch: Partial<T> | undefined): T {
  const merged = { ...stored }
  if (!patch) return merged
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key]
    if (value !== undefined) merged[key] = value as T[keyof T]
  }
  return merged
}
