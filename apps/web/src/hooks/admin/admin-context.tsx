'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { AdminApiClient } from '@/lib/admin-api'

const AdminApiContext = createContext<AdminApiClient | null>(null)

export function AdminApiProvider({
  children,
  client,
}: {
  children: ReactNode
  client?: AdminApiClient
}) {
  const value = useMemo(() => client ?? new AdminApiClient(), [client])
  return <AdminApiContext.Provider value={value}>{children}</AdminApiContext.Provider>
}

export function useAdminApi(): AdminApiClient {
  const v = useContext(AdminApiContext)
  if (!v) {
    throw new Error('`useAdminApi` must be called from inside <AdminApiProvider/>.')
  }
  return v
}
