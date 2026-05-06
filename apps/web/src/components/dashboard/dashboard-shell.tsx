'use client'

import { useState } from 'react'
import { DashboardSidebar } from './sidebar'
import { DashboardTopbar } from './topbar'
import { DashboardFooter } from './dashboard-footer'

/**
 * Client-side wrapper that owns sidebar open/close state.
 *
 * The right column is `min-h-screen flex-col`. The page-content `<main>`
 * grows with `flex-1` so the `<DashboardFooter />` always sits at the
 * viewport bottom even when content is short.
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
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardTopbar title={title} menuOpen={open} onMenuClick={() => setOpen((o) => !o)} />
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex-1">{children}</div>
          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}
