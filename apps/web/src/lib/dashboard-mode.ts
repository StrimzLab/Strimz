import { useEffect, useState } from 'react'

export type DashboardMode = 'test' | 'live'

const STORAGE_KEY = 'strimz.dashboardMode'

export function getDashboardMode(): DashboardMode {
  if (typeof window === 'undefined') return 'test'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw === 'live' ? 'live' : 'test'
}

export function setDashboardMode(mode: DashboardMode): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, mode)
}

export function useDashboardMode(): DashboardMode {
  const [mode, setMode] = useState<DashboardMode>('test')
  useEffect(() => {
    setMode(getDashboardMode())
  }, [])
  return mode
}
