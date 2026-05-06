'use client'

import { useState } from 'react'
import { DashboardSidebar } from './sidebar'
import { DashboardTopbar } from './topbar'
import { DashboardFooter } from './dashboard-footer'

/**
 * Client-side wrapper that owns sidebar open/close state. Lives outside
 * the route layout so individual pages can lift `title` into the topbar
 * via a server-rendered prop.
 */
export function DashboardShell({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen bg-white">
      <DashboardSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar title={title} menuOpen={open} onMenuClick={() => setOpen((o) => !o)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}
