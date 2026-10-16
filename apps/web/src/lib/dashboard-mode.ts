import { arcModeFor } from '@strimz/shared-config'

import { env } from './env'

export type DashboardMode = 'test' | 'live'

export function getDashboardMode(): DashboardMode {
  return arcModeFor(env.arcEnvironment)
}

export function useDashboardMode(): DashboardMode {
  return getDashboardMode()
}
