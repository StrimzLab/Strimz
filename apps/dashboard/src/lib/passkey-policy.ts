import type { DashboardMode } from '@strimz/web-shared/lib/dashboard-mode'

/** Strimz's own passkey checks apply to live mode only. Privy still asks before wallet signatures. */
export function asksStrimzPasskey(mode: DashboardMode): boolean {
  return mode === 'live'
}
