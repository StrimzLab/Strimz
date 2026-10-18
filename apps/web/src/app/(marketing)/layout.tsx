import type { ReactNode } from 'react'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { MOTION_GATE_SCRIPT } from '@/components/marketing/motion/gate'
import { SmoothScroll } from '@/components/marketing/motion/smooth-scroll'
import { Toaster } from '@/components/marketing/toast/toaster'
import { ScrollRefresh } from '@/components/marketing/motion/scroll-refresh'
import { BackToTop } from '@/components/marketing/back-to-top'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE_SCRIPT }} />
      <SmoothScroll />
      <ScrollRefresh />
      <MarketingNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <BackToTop />
      <Toaster />
    </div>
  )
}
