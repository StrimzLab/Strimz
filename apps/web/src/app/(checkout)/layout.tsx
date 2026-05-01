import { AuroraBackground } from '@/components/effects/aurora-background'
import { Logo } from '@/components/shared/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground variant="soft" />

      <header className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl">{children}</main>
    </div>
  )
}
