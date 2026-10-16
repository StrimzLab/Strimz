'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { Loader2 } from 'lucide-react'
import { Button } from '@strimz/ui'
import { DashboardSidebar } from './sidebar'
import { DashboardTopbar } from './topbar'
import { DashboardFooter } from './dashboard-footer'
import { useMerchantMe } from '@/hooks/api/use-merchant'
import { dashboardGate, withNext } from '@/lib/auth-redirect'

export function DashboardShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const privy = usePrivyOrNull()
  const privyReady = privy ? privy.ready : true
  const authenticated = privy ? privy.authenticated : false
  const merchantQuery = useMerchantMe({ enabled: privyReady && authenticated })
  const gate = dashboardGate({
    privyReady,
    authenticated,
    merchant: {
      isPending: merchantQuery.isPending,
      error: merchantQuery.error,
      data: merchantQuery.data,
    },
  })

  useEffect(() => {
    if (gate.kind === 'login') router.replace(withNext('/login', pathname))
    if (gate.kind === 'sync') router.replace(withNext('/callback', pathname))
    if (gate.kind === 'onboarding') router.replace('/onboarding')
  }, [gate.kind, pathname, router])

  const [open, setOpen] = useState(false)

  if (gate.kind === 'error') {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="border-border/60 bg-card mx-auto max-w-md space-y-4 rounded-xl border p-6 text-center">
          <h1 className="font-sora text-xl font-semibold">Couldn’t load your account</h1>
          <p className="text-muted-foreground text-sm">{gate.message}</p>
          <Button variant="outline" onClick={() => merchantQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (gate.kind !== 'ready') {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen">
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

function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
