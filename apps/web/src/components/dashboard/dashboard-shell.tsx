'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { DashboardSidebar } from './sidebar'
import { DashboardTopbar } from './topbar'
import { DashboardFooter } from './dashboard-footer'
import { useMerchantMe } from '@/hooks/api/use-merchant'

export function DashboardShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const { data: merchant, isPending } = useMerchantMe()
  const needsOnboarding = !!merchant && !merchant.onboardingCompleted

  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding')
  }, [needsOnboarding, router])

  const [open, setOpen] = useState(false)

  if (isPending || needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="size-6 animate-spin text-[#02C76A]" />
      </div>
    )
  }

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
