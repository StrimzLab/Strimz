'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { Loader2 } from 'lucide-react'
import { Button } from '@strimz/ui'
import { PasskeyMfaPrompt } from '@/components/dashboard/passkey-mfa-prompt'
import { DashboardSidebar } from './sidebar'
import { DashboardTopbar } from './topbar'
import { TestModeBanner } from '@strimz/web-shared/components/dashboard/test-mode-banner'
import { DashboardFooter } from './dashboard-footer'
import { usePrimaryMerchantMe } from '@/hooks/api/use-merchant'
import { useDashboardMode } from '@strimz/web-shared/lib/dashboard-mode'
import { addedTestNetwork } from '@strimz/web-shared/lib/networks'
import { TestAccountReady } from './test-account-ready'
import { SIDEBAR_OPEN_EVENT, stopDashboardTour } from '@/hooks/use-dashboard-tour'
import { hasPasskeyMfa } from '@/hooks/use-passkey-mfa'
import { dashboardGate, withNext } from '@strimz/web-shared/lib/auth-redirect'

export function DashboardShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const privy = usePrivyOrNull()
  const privyReady = privy ? privy.ready : true
  const authenticated = privy ? privy.authenticated : false
  const merchantQuery = usePrimaryMerchantMe({ enabled: privyReady && authenticated })
  const mode = useDashboardMode()
  const gate = dashboardGate({
    privyReady,
    authenticated,
    passkeyEnrolled: hasPasskeyMfa(privy?.user ?? null),
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
    if (gate.kind === 'terms') router.replace(withNext('/terms', pathname))
    if (gate.kind === 'passkey') router.replace(withNext('/passkey', pathname))
  }, [gate.kind, pathname, router])

  // The tour draws over the whole page, so it would outlive a sign-out or a page change.
  useEffect(() => {
    if (gate.kind !== 'ready') stopDashboardTour()
  }, [gate.kind])
  useEffect(() => stopDashboardTour, [pathname])

  const [open, setOpen] = useState(false)
  useEffect(() => {
    const openSidebar = () => setOpen(true)
    window.addEventListener(SIDEBAR_OPEN_EVENT, openSidebar)
    return () => window.removeEventListener(SIDEBAR_OPEN_EVENT, openSidebar)
  }, [])

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
        <Loader2 className="text-brand-text size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen">
      <DashboardSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardTopbar title={title} menuOpen={open} onMenuClick={() => setOpen((o) => !o)} />
        <TestModeBanner>
          Payments use testnet USDC from the faucet. Nothing here touches real money.
        </TestModeBanner>
        <PasskeyMfaPrompt />
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex-1">
            {addedTestNetwork && mode === 'test' && merchantQuery.data ? (
              <TestAccountReady primary={merchantQuery.data}>{children}</TestAccountReady>
            ) : (
              children
            )}
          </div>
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
