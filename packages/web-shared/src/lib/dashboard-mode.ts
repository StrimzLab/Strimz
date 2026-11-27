import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { arcModeFor } from '@strimz/shared-config'

import { env } from './env'
import { networkFor, networks, type Network } from './networks'

export type DashboardMode = 'test' | 'live'

const STORAGE_KEY = 'strimz.dashboard-mode'
const isMode = (v: unknown): v is DashboardMode => v === 'test' || v === 'live'

/** The build's own mode. Apps without a mode provider (admin, until step 5) use this. */
export function getDashboardMode(): DashboardMode {
  return arcModeFor(env.arcEnvironment)
}

/** New browsers start in test mode when it exists (ADR-2026-11-26-test-mode). */
export function initialMode(available: DashboardMode[], stored: string | null): DashboardMode {
  if (isMode(stored) && available.includes(stored)) return stored
  return available.includes('test') ? 'test' : (available[0] ?? getDashboardMode())
}

export function readStoredMode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeMode(mode: DashboardMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Private windows can refuse storage; the switch still works for this visit.
  }
}

interface ModeContext {
  mode: DashboardMode
  modes: DashboardMode[]
  setMode: (mode: DashboardMode) => void
}

const Context = createContext<ModeContext | null>(null)

export function DashboardModeProvider({
  children,
  onChange,
}: {
  children: ReactNode
  /** Runs before the switch, e.g. to drop cached data from the other mode. */
  onChange?: (mode: DashboardMode) => void
}) {
  const modes = useMemo(() => networks.map((n) => n.mode), [])
  const [mode, setState] = useState<DashboardMode>(() => initialMode(modes, readStoredMode()))
  const setMode = useCallback(
    (next: DashboardMode) => {
      if (!modes.includes(next)) return
      onChange?.(next)
      storeMode(next)
      setState(next)
    },
    [modes, onChange],
  )
  const value = useMemo(() => ({ mode, modes, setMode }), [mode, modes, setMode])
  return createElement(Context.Provider, { value }, children)
}

export function useDashboardMode(): DashboardMode {
  return useContext(Context)?.mode ?? getDashboardMode()
}

export function useDashboardModeSwitch(): ModeContext | null {
  return useContext(Context)
}

export function useNetwork(): Network {
  return networkFor(useDashboardMode())
}
